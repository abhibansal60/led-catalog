const DB_NAME = "led-catalog";
const DB_VERSION = 1;
const PROGRAM_STORE = "programs";
const SETTINGS_STORE = "settings";
const DIRECTORY_KEY = "directoryHandle";

export type ControllerType = "t1000" | "t8000";

export type StoredProgram = {
  id: string;
  name: string;
  description: string;
  originalLedName: string;
  storedFileName: string;
  photoDataUrl: string | null;
  dateAdded: string;
  fileSizeBytes?: number | null;
  controller?: ControllerType;
};

type StoredSettings = {
  directoryHandle?: FileSystemDirectoryHandle;
};

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROGRAM_STORE)) {
        db.createObjectStore(PROGRAM_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open database"));
  });

const runTransaction = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  runner: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    let request: IDBRequest<T>;
    try {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      request = runner(store);

      transaction.oncomplete = () => {
        db.close();
        resolve(request.result as T);
      };
      transaction.onabort = () => {
        const error = transaction.error ?? new Error("IndexedDB transaction aborted");
        db.close();
        reject(error);
      };
      transaction.onerror = () => {
        const error = transaction.error ?? new Error("IndexedDB transaction failed");
        db.close();
        reject(error);
      };

      request.onerror = () => {
        const error = request.error ?? new Error("IndexedDB request failed");
        db.close();
        reject(error);
      };
    } catch (error) {
      db.close();
      const normalized =
        error instanceof Error ? error : new Error(String(error));
      reject(normalized);
    }
  });
};

export const getAllPrograms = async (): Promise<StoredProgram[]> =>
  runTransaction<StoredProgram[]>(PROGRAM_STORE, "readonly", (store) => store.getAll());

export const saveProgram = async (program: StoredProgram): Promise<void> => {
  await runTransaction(PROGRAM_STORE, "readwrite", (store) => store.put(program));
};

export const deleteProgram = async (id: string): Promise<void> => {
  await runTransaction(PROGRAM_STORE, "readwrite", (store) => store.delete(id));
};

export const clearPrograms = async (): Promise<void> => {
  await runTransaction(PROGRAM_STORE, "readwrite", (store) => store.clear());
};

export const getStoredDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  const settings = (await runTransaction<StoredSettings | undefined>(
    SETTINGS_STORE,
    "readonly",
    (store) => store.get(DIRECTORY_KEY)
  )) as StoredSettings | undefined;
  return settings?.directoryHandle ?? null;
};

export const setStoredDirectoryHandle = async (
  handle: FileSystemDirectoryHandle | null
): Promise<void> => {
  if (handle) {
    await runTransaction(SETTINGS_STORE, "readwrite", (store) =>
      store.put({ directoryHandle: handle }, DIRECTORY_KEY)
    );
  } else {
    await runTransaction(SETTINGS_STORE, "readwrite", (store) => store.delete(DIRECTORY_KEY));
  }
};
