export const clearDirectoryContents = async (directory: FileSystemDirectoryHandle): Promise<void> => {
  const names: string[] = [];
  for await (const [name] of directory.entries()) {
    names.push(name);
  }
  for (const name of names) {
    await directory.removeEntry(name, { recursive: true });
  }
};
