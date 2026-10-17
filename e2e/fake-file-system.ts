// In-memory stand-in for the File System Access API, injected with
// page.addInitScript. Playwright serializes this function, so it must not
// reference anything outside its own body.
//
// Pickers never open a native dialog: each call consumes the next response a
// test queued on window.__fakeFs (a path, or the name of a DOMException to
// throw). A picker call with nothing queued is recorded as unexpected and
// fails the test in the fixture teardown.
export function installFakeFileSystemAccess(): void {
  type FileNode = {
    kind: "file";
    name: string;
    data: Uint8Array;
    lastModified: number;
    parent: DirectoryNode;
  };
  type DirectoryNode = {
    kind: "directory";
    name: string;
    children: Map<string, FileNode | DirectoryNode>;
    failWritesWith?: string;
  };
  type EntryNode = FileNode | DirectoryNode;
  type PickerKind = "directory" | "open" | "save";
  type PickerResponse = { path: string } | { error: string };
  type Permission = { query: PermissionState; request?: PermissionState };

  const root: DirectoryNode = { kind: "directory", name: "", children: new Map() };
  const nodeOf = new WeakMap<object, EntryNode>();
  const permissions = new WeakMap<EntryNode, Permission>();
  const queues: Record<PickerKind, PickerResponse[]> = { directory: [], open: [], save: [] };
  const pickerCalls: Array<{ kind: PickerKind; options: unknown }> = [];
  const unexpectedPickerCalls: PickerKind[] = [];

  const fail = (name: string, message: string): never => {
    throw new DOMException(message, name);
  };

  const splitPath = (path: string): string[] => path.split("/").filter(Boolean);

  const resolveDirectory = (path: string, create: boolean): DirectoryNode => {
    let current = root;
    for (const segment of splitPath(path)) {
      let next = current.children.get(segment);
      if (!next && create) {
        next = { kind: "directory", name: segment, children: new Map() };
        current.children.set(segment, next);
      }
      if (!next) fail("NotFoundError", `No directory at ${path}`);
      if (next!.kind !== "directory") fail("TypeMismatchError", `${path} is a file`);
      current = next as DirectoryNode;
    }
    return current;
  };

  const resolveParent = (path: string, create: boolean): [DirectoryNode, string] => {
    const segments = splitPath(path);
    const name = segments.pop();
    if (!name) fail("TypeError", `Not a file path: ${path}`);
    return [resolveDirectory(segments.join("/"), create), name!];
  };

  const resolveFile = (path: string): FileNode => {
    const [parent, name] = resolveParent(path, false);
    const node = parent.children.get(name);
    if (!node) fail("NotFoundError", `No file at ${path}`);
    if (node!.kind !== "file") fail("TypeMismatchError", `${path} is a directory`);
    return node as FileNode;
  };

  const createFile = (parent: DirectoryNode, name: string): FileNode => {
    const node: FileNode = { kind: "file", name, data: new Uint8Array(), lastModified: Date.now(), parent };
    parent.children.set(name, node);
    return node;
  };

  const toBytes = async (data: unknown): Promise<Uint8Array> => {
    if (typeof data === "string") return new TextEncoder().encode(data);
    if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
    if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0));
    if (ArrayBuffer.isView(data)) {
      return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    }
    return fail("TypeError", "Unsupported write payload");
  };

  // Handles keep only kind and name as own properties, so IndexedDB can
  // structured-clone them the way the app stores the real catalog folder handle.
  class FakeHandle {
    readonly kind: "file" | "directory";
    readonly name: string;

    constructor(node: EntryNode) {
      this.kind = node.kind;
      this.name = node.name;
      nodeOf.set(this, node);
    }

    protected get node(): EntryNode {
      return nodeOf.get(this)!;
    }

    async queryPermission(): Promise<PermissionState> {
      return permissions.get(this.node)?.query ?? "granted";
    }

    async requestPermission(): Promise<PermissionState> {
      const permission = permissions.get(this.node);
      const result = permission?.request ?? permission?.query ?? "granted";
      permissions.set(this.node, { query: result });
      return result;
    }
  }

  class FakeFileHandle extends FakeHandle {
    async getFile(): Promise<File> {
      const node = this.node as FileNode;
      return new File([node.data], node.name, { lastModified: node.lastModified });
    }

    async createWritable() {
      const node = this.node as FileNode;
      const chunks: Uint8Array[] = [];
      let open = true;
      const assertOpen = () => {
        if (!open) fail("TypeError", "Stream is closed");
      };
      return {
        async write(data: unknown) {
          assertOpen();
          if (node.parent.failWritesWith) fail(node.parent.failWritesWith, "Fake write failure");
          chunks.push(await toBytes(data));
        },
        async close() {
          assertOpen();
          open = false;
          const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
          const data = new Uint8Array(total);
          let offset = 0;
          for (const chunk of chunks) {
            data.set(chunk, offset);
            offset += chunk.length;
          }
          node.data = data;
          node.lastModified = Date.now();
        },
        async abort() {
          open = false;
        },
      };
    }
  }

  class FakeDirectoryHandle extends FakeHandle {
    async getFileHandle(name: string, options: { create?: boolean } = {}) {
      const parent = this.node as DirectoryNode;
      const existing = parent.children.get(name);
      if (existing?.kind === "directory") fail("TypeMismatchError", `${name} is a directory`);
      if (!existing && !options.create) fail("NotFoundError", `No file named ${name}`);
      return new FakeFileHandle(existing ?? createFile(parent, name));
    }

    async getDirectoryHandle(name: string, options: { create?: boolean } = {}) {
      const parent = this.node as DirectoryNode;
      let existing = parent.children.get(name);
      if (existing?.kind === "file") fail("TypeMismatchError", `${name} is a file`);
      if (!existing && !options.create) fail("NotFoundError", `No directory named ${name}`);
      if (!existing) {
        existing = { kind: "directory", name, children: new Map() };
        parent.children.set(name, existing);
      }
      return new FakeDirectoryHandle(existing);
    }

    async removeEntry(name: string, options: { recursive?: boolean } = {}) {
      const parent = this.node as DirectoryNode;
      const existing = parent.children.get(name);
      if (!existing) fail("NotFoundError", `No entry named ${name}`);
      if (existing!.kind === "directory" && existing!.children.size > 0 && !options.recursive) {
        fail("InvalidModificationError", `${name} is not empty`);
      }
      parent.children.delete(name);
    }

    async *entries(): AsyncGenerator<[string, FakeHandle]> {
      for (const [name, node] of [...(this.node as DirectoryNode).children]) {
        yield [name, node.kind === "file" ? new FakeFileHandle(node) : new FakeDirectoryHandle(node)];
      }
    }
  }

  const takePickerResponse = (kind: PickerKind, options: unknown): string => {
    pickerCalls.push({ kind, options: JSON.parse(JSON.stringify(options ?? {})) });
    const response = queues[kind].shift();
    if (!response) {
      unexpectedPickerCalls.push(kind);
      throw new Error(`Unexpected ${kind} picker call: no fake response queued`);
    }
    if ("error" in response) fail(response.error, `Fake ${kind} picker failure`);
    return (response as { path: string }).path;
  };

  Object.assign(window, {
    showDirectoryPicker: async (options?: unknown) =>
      new FakeDirectoryHandle(resolveDirectory(takePickerResponse("directory", options), true)),
    showOpenFilePicker: async (options?: unknown) => [
      new FakeFileHandle(resolveFile(takePickerResponse("open", options))),
    ],
    // A path ending in "/" saves under the app's suggestedName in that folder.
    showSaveFilePicker: async (options?: { suggestedName?: string }) => {
      let path = takePickerResponse("save", options);
      if (path.endsWith("/")) path += options?.suggestedName ?? "untitled";
      const [parent, name] = resolveParent(path, true);
      const existing = parent.children.get(name);
      if (existing?.kind === "directory") fail("TypeMismatchError", `${path} is a directory`);
      return new FakeFileHandle(existing ?? createFile(parent, name));
    },
  });

  (window as unknown as { __fakeFs: unknown }).__fakeFs = {
    queue(kind: PickerKind, response: PickerResponse) {
      queues[kind].push(response);
    },
    writeFile(path: string, bytes: number[]) {
      const [parent, name] = resolveParent(path, true);
      const node = createFile(parent, name);
      node.data = Uint8Array.from(bytes);
    },
    readFile(path: string): number[] {
      return Array.from(resolveFile(path).data);
    },
    mkdir(path: string) {
      resolveDirectory(path, true);
    },
    remove(path: string) {
      const [parent, name] = resolveParent(path, false);
      parent.children.delete(name);
    },
    list(path: string): string[] {
      return [...resolveDirectory(path, false).children.keys()].sort();
    },
    exists(path: string): boolean {
      try {
        const [parent, name] = resolveParent(path, false);
        return parent.children.has(name);
      } catch {
        return false;
      }
    },
    setPermission(path: string, permission: Permission) {
      permissions.set(resolveDirectory(path, true), permission);
    },
    failWrites(path: string, errorName: string) {
      resolveDirectory(path, true).failWritesWith = errorName;
    },
    state() {
      return {
        pending: Object.fromEntries(Object.entries(queues).map(([kind, queue]) => [kind, queue.length])),
        unexpected: [...unexpectedPickerCalls],
        calls: [...pickerCalls],
      };
    },
  };
}
