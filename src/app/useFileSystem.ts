import { useCallback, useEffect } from "react";
import { DEFAULT_CONTROLLER, Program, getEmptyForm, sortPrograms } from "@/lib/catalog";
import {
  getAllPrograms,
  getStoredDirectoryHandle,
  saveProgram as saveStoredProgram,
  setStoredDirectoryHandle,
} from "@/lib/storage";
import type { useAppState } from "./useAppState";

type Deps = ReturnType<typeof useAppState>;

export function useFileSystem(s: Deps) {
  const {
    setPrograms,
    setFeedback,
    setIsLoadingPrograms,
    setIsFileSystemSupported,
    setDirectoryHandle,
    setDirectoryPermission,
    setHasPersistentStorage,
    editingProgramId,
    programs,
    setEditingProgramId,
    setShouldRemovePhoto,
    setFormData,
    feedback,
    directoryHandle,
    directoryPermission,
    isFileSystemSupported,
  } = s;

  useEffect(() => {
    let isMounted = true;

    const loadPrograms = async () => {
      try {
        const storedPrograms = await getAllPrograms();
        if (isMounted) {
          const normalizedPrograms = storedPrograms.map((program) => ({
            ...program,
            controller: program.controller ?? DEFAULT_CONTROLLER,
            isFileMissing: program.isFileMissing ?? false,
          }));
          setPrograms(sortPrograms(normalizedPrograms));
        }
      } catch (error) {
        console.error("⚠️ Could not load saved programs", error);
        if (isMounted) {
          setFeedback({
            type: "error",
            message: "Catalog load failed. कैटलॉग लोड नहीं हो पाया.",
          });
        }
      } finally {
        if (isMounted) {
          setIsLoadingPrograms(false);
        }
      }
    };

    loadPrograms();

    if (typeof window !== "undefined") {
      const supported = "showDirectoryPicker" in window;
      if (isMounted) {
        setIsFileSystemSupported(supported);
      }
      if (supported) {
        (async () => {
          try {
            const storedHandle = await getStoredDirectoryHandle();
            if (!isMounted) {
              return;
            }
            if (storedHandle) {
              setDirectoryHandle(storedHandle);
              try {
                const permission = await storedHandle.queryPermission({ mode: "readwrite" });
                if (isMounted) {
                  setDirectoryPermission(permission);
                }
              } catch (permissionError) {
                console.warn("⚠️ Could not query directory permission", permissionError);
              }
            }
          } catch (error) {
            console.error("⚠️ Failed to restore directory handle", error);
          }
        })();
      }
    }

    if (typeof navigator !== "undefined" && navigator.storage?.persisted) {
      navigator.storage
        .persisted()
        .then((persisted) => {
          if (isMounted) {
            setHasPersistentStorage(persisted);
          }
        })
        .catch((error) => {
          console.warn("⚠️ Could not determine persistent storage state", error);
        });
    }

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!editingProgramId) {
      return;
    }
    const existingProgram = programs.find((program) => program.id === editingProgramId);
    if (!existingProgram) {
      setEditingProgramId(null);
      setShouldRemovePhoto(false);
      setFormData(getEmptyForm());
    }
  }, [editingProgramId, programs]);

  useEffect(() => {
    if (!feedback) {
      return;
    }
    const timerId = window.setTimeout(() => setFeedback(null), 5000);
    return () => window.clearTimeout(timerId);
  }, [feedback]);

  useEffect(() => {
    if (!directoryHandle || directoryPermission !== "granted") {
      return;
    }

    const missingPrograms = programs.filter(
      (program) => program.fileSizeBytes === undefined || program.fileSizeBytes === null
    );

    if (missingPrograms.length === 0) {
      return;
    }

    let isActive = true;

    (async () => {
      const updates: Program[] = [];

      for (const program of missingPrograms) {
        try {
          const fileHandle = await directoryHandle.getFileHandle(program.storedFileName, { create: false });
          const file = await fileHandle.getFile();
          updates.push({ ...program, fileSizeBytes: file.size });
        } catch (error) {
          console.warn("⚠️ Could not determine file size", error);
        }
      }

      if (!isActive || updates.length === 0) {
        return;
      }

      setPrograms((prev) => {
        const updateMap = new Map(updates.map((program) => [program.id, program]));
        return sortPrograms(prev.map((program) => updateMap.get(program.id) ?? program));
      });

      await Promise.allSettled(updates.map((program) => saveStoredProgram(program)));
    })();

    return () => {
      isActive = false;
    };
  }, [directoryHandle, directoryPermission, programs]);

  const ensurePersistentStorage = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.storage) {
      return;
    }

    try {
      if (navigator.storage.persisted) {
        const alreadyPersisted = await navigator.storage.persisted();
        if (alreadyPersisted) {
          setHasPersistentStorage(true);
          return;
        }
      }

      if (!navigator.storage.persist) {
        return;
      }

      const persisted = await navigator.storage.persist();
      setHasPersistentStorage(persisted);
      if (persisted) {
        console.log("🔒 Persistent storage granted");
      } else {
        console.warn("⚠️ Persistent storage request was denied");
      }
    } catch (error) {
      console.warn("⚠️ Persistent storage request failed", error);
    }
  }, []);

  const ensureDirectoryAccess = async ({
    showSuccessMessage = false,
  }: { showSuccessMessage?: boolean } = {}): Promise<FileSystemDirectoryHandle | null> => {
    if (!isFileSystemSupported) {
      setFeedback({
        type: "error",
        message: "Browser unsupported. ब्राउज़र यह फीचर नहीं चला सकता.",
      });
      return null;
    }

    let handle = directoryHandle;
    try {
      if (handle) {
        const permission = await handle.queryPermission({ mode: "readwrite" });
        setDirectoryPermission(permission);
        if (permission === "granted") {
          await ensurePersistentStorage();
          if (showSuccessMessage) {
            setFeedback({
              type: "success",
              message: `Folder ready: ${handle.name}. फ़ोल्डर जुड़ गया।`,
            });
          }
          return handle;
        }
        if (permission === "prompt") {
          const requested = await handle.requestPermission({ mode: "readwrite" });
          setDirectoryPermission(requested);
          if (requested === "granted") {
            await setStoredDirectoryHandle(handle);
            await ensurePersistentStorage();
            if (showSuccessMessage) {
              setFeedback({
                type: "success",
                message: `Folder ready: ${handle.name}. फ़ोल्डर जुड़ गया।`,
              });
            }
            return handle;
          }
          if (requested === "denied") {
            await setStoredDirectoryHandle(null);
            setDirectoryHandle(null);
            setDirectoryPermission(null);
            handle = null;
          }
        }
        if (permission === "denied") {
          await setStoredDirectoryHandle(null);
          setDirectoryHandle(null);
          setDirectoryPermission(null);
          handle = null;
        }
      }

      const pickedHandle = await window.showDirectoryPicker({
        id: "led-catalog-storage",
        mode: "readwrite",
      });
      const permission = await pickedHandle.requestPermission({ mode: "readwrite" });
      setDirectoryPermission(permission);
      if (permission === "granted") {
        setDirectoryHandle(pickedHandle);
        await setStoredDirectoryHandle(pickedHandle);
        await ensurePersistentStorage();
        if (showSuccessMessage) {
          setFeedback({
            type: "success",
            message: `Folder ready: ${pickedHandle.name}. फ़ोल्डर जुड़ गया।`,
          });
        }
        return pickedHandle;
      }
      setDirectoryHandle(null);
      setDirectoryPermission(null);
      await setStoredDirectoryHandle(null);
      setFeedback({
        type: "error",
        message: "Storage permission denied. स्टोरेज अनुमति नहीं मिली.",
      });
      return null;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return null;
      }
      console.error("❌ Directory access failed", error);
      setFeedback({
        type: "error",
        message: "Could not access folder. फ़ोल्डर एक्सेस नहीं मिला.",
      });
      return null;
    }
  };

  const ensureStorageCapacity = useCallback(async (requiredBytes: number) => {
    if (!navigator.storage?.estimate) {
      return true;
    }
    try {
      const { quota, usage } = await navigator.storage.estimate();
      if (quota && typeof usage === "number") {
        const available = quota - usage;
        if (available < requiredBytes) {
          setFeedback({
            type: "error",
            message: "Not enough storage space. स्टोरेज में जगह नहीं है.",
          });
          return false;
        }
      }
    } catch (error) {
      console.warn("⚠️ Storage estimate failed", error);
    }
    return true;
  }, []);

  return {
    ensurePersistentStorage,
    ensureDirectoryAccess,
    ensureStorageCapacity,
  };
}
