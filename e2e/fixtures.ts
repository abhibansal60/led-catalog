import { test as base, expect, type Page } from "@playwright/test";
import { installFakeFileSystemAccess } from "./fake-file-system";

type PickerKind = "directory" | "open" | "save";
type PickerResponse = { path: string } | { error: string };
type Permission = { query: PermissionState; request?: PermissionState };

// Node-side driver for the in-page fake (window.__fakeFs).
export class FakeFs {
  constructor(private readonly page: Page) {}

  private call<T>(method: string, ...args: unknown[]): Promise<T> {
    return this.page.evaluate(
      ([name, params]) => (window as any).__fakeFs[name as string](...(params as unknown[])),
      [method, args] as const
    );
  }

  /** The next picker of this kind resolves to `path`. */
  pick(kind: PickerKind, path: string) {
    return this.call<void>("queue", kind, { path } satisfies PickerResponse);
  }

  /** The next picker of this kind rejects with a DOMException named `error`. */
  pickFails(kind: PickerKind, error: "AbortError" | "NotAllowedError" | "SecurityError") {
    return this.call<void>("queue", kind, { error } satisfies PickerResponse);
  }

  writeFile(path: string, contents: Buffer | string) {
    return this.call<void>("writeFile", path, [...Buffer.from(contents)]);
  }

  async readFile(path: string): Promise<Buffer> {
    return Buffer.from(await this.call<number[]>("readFile", path));
  }

  async readText(path: string): Promise<string> {
    return (await this.readFile(path)).toString("utf8");
  }

  async readJson<T = any>(path: string): Promise<T> {
    return JSON.parse(await this.readText(path));
  }

  mkdir(path: string) {
    return this.call<void>("mkdir", path);
  }

  list(path: string) {
    return this.call<string[]>("list", path);
  }

  exists(path: string) {
    return this.call<boolean>("exists", path);
  }

  setPermission(path: string, permission: Permission) {
    return this.call<void>("setPermission", path, permission);
  }

  failWrites(path: string, errorName: string) {
    return this.call<void>("failWrites", path, errorName);
  }

  state() {
    return this.call<{
      pending: Record<PickerKind, number>;
      unexpected: PickerKind[];
      calls: Array<{ kind: PickerKind; options: Record<string, unknown> }>;
    }>("state");
  }
}

export class SyncMock {
  /** JSON bodies POSTed to /api/sync, in order. */
  readonly posts: any[] = [];
  status = 200;
}

export class Dialogs {
  /** Text of every alert/confirm/prompt the app showed, in order. */
  readonly messages: string[] = [];
  /** Answer for the next confirm/prompt; dialogs are accepted when unset. */
  nextAnswer: boolean | null = null;
}

type Fixtures = { fs: FakeFs; sync: SyncMock; dialogs: Dialogs };

export const test = base.extend<Fixtures>({
  sync: async ({ page }, use) => {
    const sync = new SyncMock();
    await page.route("**/api/sync", async (route) => {
      sync.posts.push(route.request().postDataJSON());
      await route.fulfill({ status: sync.status, contentType: "application/json", body: "{}" });
    });
    await use(sync);
  },

  dialogs: async ({ page }, use) => {
    const dialogs = new Dialogs();
    page.on("dialog", async (dialog) => {
      dialogs.messages.push(dialog.message());
      const answer = dialogs.nextAnswer ?? true;
      dialogs.nextAnswer = null;
      await (answer ? dialog.accept() : dialog.dismiss());
    });
    await use(dialogs);
  },

  // Depends on sync and dialogs so their handlers exist before the app loads.
  fs: async ({ page, sync: _sync, dialogs: _dialogs }, use) => {
    await page.addInitScript(installFakeFileSystemAccess);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Bansal Lights - LED Catalog" })).toBeVisible();
    const fs = new FakeFs(page);
    await use(fs);
    const { pending, unexpected } = await fs.state();
    expect(unexpected, "picker opened with no queued response").toEqual([]);
    expect(pending, "queued picker response never consumed").toEqual({ directory: 0, open: 0, save: 0 });
  },
});

export { expect };

/** A .led file that passes parseLedHeader, with a payload derived from `seed`. */
export function makeLedFile(seed: number, payloadBytes = 4096): Buffer {
  const bytes = Buffer.alloc(39 + payloadBytes);
  bytes.write("rzbv001", 0, "latin1");
  bytes.set([0x00, 0x55, 0xaa, 0x00], 20);
  bytes.writeUInt16BE(1000, 37);
  let state = seed;
  for (let i = 39; i < bytes.length; i += 1) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    bytes[i] = state & 0xff;
  }
  return bytes;
}

export function feedback(page: Page) {
  return page.locator('[role="status"][aria-live="polite"].mb-6');
}

export async function readStoredPrograms(page: Page): Promise<any[]> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("led-catalog");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const request = db.transaction("programs", "readonly").objectStore("programs").getAll();
          request.onsuccess = () => {
            db.close();
            resolve(request.result);
          };
          request.onerror = () => reject(request.error);
        };
      })
  );
}

export async function readStoredDirectoryHandle(page: Page): Promise<{ kind: string; name: string } | null> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("led-catalog");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const request = db.transaction("settings", "readonly").objectStore("settings").get("directoryHandle");
          request.onsuccess = () => {
            db.close();
            resolve(request.result?.directoryHandle ?? null);
          };
          request.onerror = () => reject(request.error);
        };
      })
  );
}

export async function connectCatalogFolder(page: Page, fs: FakeFs, path = "/catalog") {
  await fs.pick("directory", path);
  await page.getByRole("button", { name: /Connect Folder/ }).click();
  await expect(page.getByText(`Folder connected: ${path.split("/").pop()}`)).toBeVisible();
}

/** Fills and submits the Add Program form; the caller queues any picker it needs. */
export async function submitProgram(page: Page, program: { name: string; ledName: string; bytes: Buffer }) {
  await page.getByRole("tab", { name: /Add New Program/ }).click();
  const panel = page.locator("#catalog-add-panel");
  await panel.locator("#programName").fill(program.name);
  await panel.locator('input[type="file"][accept=".led"]').setInputFiles({
    name: program.ledName,
    mimeType: "application/octet-stream",
    buffer: program.bytes,
  });
  await expect(panel.getByText(`File ready: ${program.ledName}`)).toBeVisible();
  await panel.getByRole("button", { name: /^Save/ }).click();
}

/** Adds a program into an already connected catalog folder. */
export async function addProgram(page: Page, program: { name: string; ledName: string; bytes: Buffer }) {
  await submitProgram(page, program);
  await expect(feedback(page)).toContainText("Program saved!");
}

export function programCard(page: Page, name: string) {
  return page.locator("#catalog-view-panel .bg-card").filter({ has: page.getByText(name, { exact: true }) });
}
