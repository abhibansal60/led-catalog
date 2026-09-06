export const writeFileToHandle = async (
  fileHandle: FileSystemFileHandle,
  file: File,
  onProgress?: (progress: number) => void
): Promise<void> => {
  const writable = await fileHandle.createWritable();
  const totalBytes = Math.max(file.size, 1);
  const reportProgress = (writtenBytes: number) => {
    if (!onProgress) {
      return;
    }
    const ratio = Math.min(1, writtenBytes / totalBytes);
    onProgress(Number.isFinite(ratio) ? ratio : 0);
  };

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let bytesWritten = 0;

  try {
    if (typeof file.stream === "function") {
      reader = file.stream().getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          await writable.write(value);
          const chunkBytes = value.length ?? value.byteLength ?? 0;
          bytesWritten += chunkBytes;
          reportProgress(bytesWritten);
        }
      }
    } else {
      await writable.write(file);
      bytesWritten = totalBytes;
    }

    await writable.close();
    reportProgress(totalBytes);
  } catch (error) {
    try {
      await writable.abort();
    } catch (abortError) {
      console.warn("⚠️ Could not abort write stream", abortError);
    }
    throw error;
  } finally {
    if (reader) {
      reader.releaseLock();
    }
  }
};
