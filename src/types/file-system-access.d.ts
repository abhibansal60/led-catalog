interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite";
}

declare type PermissionState = "granted" | "denied" | "prompt";

declare interface FileSystemHandle {
  readonly kind: "file" | "directory";
  readonly name: string;
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

declare interface FileSystemCreateWritableOptions {
  keepExistingData?: boolean;
}

declare interface FileSystemGetFileOptions {
  create?: boolean;
}

declare interface FileSystemRemoveOptions {
  recursive?: boolean;
}

declare interface FileSystemFileHandle extends FileSystemHandle {
  getFile(): Promise<File>;
  createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
}

declare interface FileSystemDirectoryHandle extends FileSystemHandle {
  getFileHandle(name: string, options?: FileSystemGetFileOptions): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: FileSystemGetFileOptions): Promise<FileSystemDirectoryHandle>;
  removeEntry(name: string, options?: FileSystemRemoveOptions): Promise<void>;
}

declare interface FileSystemWritableFileStream {
  write(data: FileSystemWriteChunkType): Promise<void>;
  close(): Promise<void>;
}

declare type FileSystemWriteChunkType = BufferSource | Blob | string | File;

declare interface Window {
  showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
}

declare interface DirectoryPickerOptions {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: FileSystemDirectoryHandle | "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";
}
