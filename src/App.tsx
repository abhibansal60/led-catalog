import React, {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Download,
  Trash2,
  PlusCircle,
  Image as ImageIcon,
  FilePlus2,
  FolderCheck,
  FolderX,
  HardDrive,
  Pencil,
  LayoutGrid,
  List,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  clearPrograms as clearStoredPrograms,
  deleteProgram as deleteStoredProgram,
  getAllPrograms,
  getStoredDirectoryHandle,
  saveProgram as saveStoredProgram,
  setStoredDirectoryHandle,
  type StoredProgram,
} from "@/lib/storage";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const REFRESH_PASSWORD = "0000";

export type Program = StoredProgram;

type FeedbackMessage = {
  type: "success" | "error";
  message: string;
};

type ProgramFormState = {
  programName: string;
  ledFile: File | null;
  description: string;
  photoFile: File | null;
};

const getEmptyForm = (): ProgramFormState => ({
  programName: "",
  ledFile: null,
  description: "",
  photoFile: null,
});

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("File read produced unexpected data type"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

const sanitizeFileName = (name: string): string =>
  name.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "-");

const sortPrograms = (items: Program[]): Program[] =>
  [...items].sort(
    (a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
  );

type CopyStatus = {
  status: "copying" | "success" | "error";
  progress: number;
};

const formatFileSize = (bytes?: number | null): string => {
  if (bytes === undefined || bytes === null) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const formatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  });

  return `${formatter.format(size)} ${units[unitIndex]}`;
};

function App(): JSX.Element {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [formData, setFormData] = useState<ProgramFormState>(getEmptyForm);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"view" | "add">("view");
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [shouldRemovePhoto, setShouldRemovePhoto] = useState(false);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [directoryPermission, setDirectoryPermission] = useState<PermissionState | null>(null);
  const [isFileSystemSupported, setIsFileSystemSupported] = useState(false);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(true);
  const [hasPersistentStorage, setHasPersistentStorage] = useState<boolean | null>(null);
  const [catalogView, setCatalogView] = useState<"grid" | "list">("grid");
  const [copyStatuses, setCopyStatuses] = useState<Record<string, CopyStatus>>({});
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadPrograms = async () => {
      try {
        const storedPrograms = await getAllPrograms();
        if (isMounted) {
          setPrograms(sortPrograms(storedPrograms));
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

  const handleTextChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    if (name === "programName" || name === "description") {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleLedFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const isLedFile = file.name.toLowerCase().endsWith(".led");
    if (!isLedFile) {
      setFormData((prev) => ({ ...prev, ledFile: null }));
      event.target.value = "";
      setFeedback({
        type: "error",
        message: "Please select a .led file. केवल .led फाइल चुनें.",
      });
      console.warn("❌ Invalid LED file selected", file.name);
      return;
    }
    setFormData((prev) => ({
      ...prev,
      ledFile: file,
    }));
    console.log("✅ LED file ready", file.name);
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setFormData((prev) => ({ ...prev, photoFile: null }));
      return;
    }
    const isValidType = ["image/jpeg", "image/png"].includes(file.type);
    const isValidSize = file.size <= MAX_PHOTO_BYTES;
    if (!isValidType) {
      event.target.value = "";
      setFeedback({
        type: "error",
        message: "Only JPG or PNG images allowed. सिर्फ JPG/PNG फोटो चलेंगे.",
      });
      console.warn("❌ Invalid image type", file.type);
      return;
    }
    if (!isValidSize) {
      event.target.value = "";
      setFeedback({
        type: "error",
        message: "Image must be under 2MB. फोटो 2MB से कम रखें.",
      });
      console.warn("❌ Photo too large", file.size);
      return;
    }
    setFormData((prev) => ({
      ...prev,
      photoFile: file,
    }));
    setShouldRemovePhoto(false);
    console.log("📸 Photo ready", file.name);
  };

  const handleCancel = (source: "user" | "system" = "user") => {
    const wasEditing = editingProgramId !== null;
    setFormData(getEmptyForm());
    setShouldRemovePhoto(false);
    setEditingProgramId(null);
    document.querySelectorAll<HTMLInputElement>("input[type='file']").forEach((input) => {
      input.value = "";
    });
    if (wasEditing) {
      setActiveTab("view");
    }
    console.log(source === "user" ? "↩️ Form cleared by user" : "↩️ Form reset");
  };


  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isEditing = editingProgramId !== null;

    if (!formData.programName.trim()) {
      setFeedback({
        type: "error",
        message: "Program name is required. प्रोग्राम नाम लिखें.",
      });
      return;
    }
    if (!formData.ledFile && !isEditing) {
      setFeedback({
        type: "error",
        message: "Please choose a .led file. कृपया .led फाइल चुनें.",
      });
      return;
    }

    setIsSaving(true);
    let createdFileName: string | null = null;
    let createdFileWasReplacement = false;
    let targetDirectory: FileSystemDirectoryHandle | null = null;

    try {
      if (isEditing) {
        const programToUpdate = editingProgramId
          ? programs.find((program) => program.id === editingProgramId)
          : null;
        if (!programToUpdate) {
          throw new Error("Program to edit was not found");
        }

        if (!formData.ledFile && formData.photoFile) {
          const hasSpaceForPhoto = await ensureStorageCapacity(formData.photoFile.size);
          if (!hasSpaceForPhoto) {
            return;
          }
        }

        let updatedStoredFileName = programToUpdate.storedFileName;
        let updatedOriginalName = programToUpdate.originalLedName;
        let updatedFileSize = programToUpdate.fileSizeBytes ?? null;

        if (formData.ledFile) {
          const requiredBytes = formData.ledFile.size + (formData.photoFile?.size ?? 0);
          const hasSpace = await ensureStorageCapacity(requiredBytes);
          if (!hasSpace) {
            return;
          }

          targetDirectory = await ensureDirectoryAccess();
          if (!targetDirectory) {
            return;
          }

          updatedStoredFileName = `${programToUpdate.id}-${sanitizeFileName(formData.ledFile.name)}`;
          const fileHandle = await targetDirectory.getFileHandle(updatedStoredFileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(formData.ledFile);
          await writable.close();
          createdFileName = updatedStoredFileName;
          createdFileWasReplacement = updatedStoredFileName === programToUpdate.storedFileName;

          if (updatedStoredFileName !== programToUpdate.storedFileName) {
            try {
              await targetDirectory.removeEntry(programToUpdate.storedFileName);
            } catch (cleanupError) {
              console.warn("⚠️ Could not remove old LED file during edit", cleanupError);
            }
          }

          updatedOriginalName = formData.ledFile.name;
          updatedFileSize = formData.ledFile.size;
        }

        const updatedPhotoDataUrl = formData.photoFile
          ? await readFileAsDataUrl(formData.photoFile)
          : shouldRemovePhoto
          ? null
          : programToUpdate.photoDataUrl;

        const updatedProgram: Program = {
          ...programToUpdate,
          name: formData.programName.trim(),
          description: formData.description.trim(),
          originalLedName: updatedOriginalName,
          storedFileName: updatedStoredFileName,
          photoDataUrl: updatedPhotoDataUrl,
          fileSizeBytes: updatedFileSize,
        };

        await saveStoredProgram(updatedProgram);
        setPrograms((prev) =>
          sortPrograms(prev.map((program) => (program.id === updatedProgram.id ? updatedProgram : program)))
        );
        handleCancel("system");
        setFeedback({
          type: "success",
          message: "Program updated. प्रोग्राम अपडेट हुआ.",
        });
        console.log("✏️ Program updated", { id: updatedProgram.id });
      } else {
        const requiredBytes = (formData.ledFile?.size ?? 0) + (formData.photoFile?.size ?? 0);
        const hasSpace = await ensureStorageCapacity(requiredBytes);
        if (!hasSpace) {
          return;
        }

        targetDirectory = await ensureDirectoryAccess();
        if (!targetDirectory) {
          return;
        }

        const id = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
        const storedFileName = `${id}-${sanitizeFileName(formData.ledFile!.name)}`;
        const fileHandle = await targetDirectory.getFileHandle(storedFileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(formData.ledFile!);
        await writable.close();
        createdFileName = storedFileName;

        const photoDataUrl = formData.photoFile ? await readFileAsDataUrl(formData.photoFile) : null;

        const newProgram: Program = {
          id,
          name: formData.programName.trim(),
          description: formData.description.trim(),
          originalLedName: formData.ledFile!.name,
          storedFileName,
          photoDataUrl,
          dateAdded: new Date().toISOString(),
          fileSizeBytes: formData.ledFile!.size,
        };

        await saveStoredProgram(newProgram);
        setPrograms((prev) => sortPrograms([newProgram, ...prev]));
        handleCancel("system");
        setActiveTab("view");
        setFeedback({
          type: "success",
          message: "Program saved! प्रोग्राम सेव हो गया.",
        });
        console.log("💾 Program saved", { name: newProgram.name, id: newProgram.id });
      }
    } catch (error) {
      console.error(isEditing ? "❌ Updating program failed" : "❌ Saving program failed", error);
      if (createdFileName && targetDirectory && !createdFileWasReplacement) {
        try {
          await targetDirectory.removeEntry(createdFileName);
        } catch (cleanupError) {
          console.warn("⚠️ Could not clean up partial file", cleanupError);
        }
      }
      setFeedback({
        type: "error",
        message: isEditing
          ? "Could not update program. प्रोग्राम अपडेट नहीं हुआ."
          : "Could not save program. प्रोग्राम सेव नहीं हुआ.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async (program: Program) => {
    try {
      const directory = await ensureDirectoryAccess();
      if (!directory) {
        return;
      }
      const fileHandle = await directory.getFileHandle(program.storedFileName, { create: false });
      const file = await fileHandle.getFile();
      const arrayBuffer = await file.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "00_program.led";
      link.type = "application/octet-stream";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      window.alert("File downloaded! Copy it to SD card.\nफाइल डाउनलोड हो गई! इसे SD कार्ड में कॉपी करें।");
      console.log("⬇️ Program downloaded", {
        id: program.id,
        originalName: program.originalLedName,
      });
    } catch (error) {
      console.error("❌ Download failed", error);
      setFeedback({
        type: "error",
        message: "Download failed. डाउनलोड नहीं हो पाया.",
      });
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("Delete this program?\nक्या यह प्रोग्राम हटाना है?");
    if (!confirmed) {
      return;
    }

    const programToDelete = programs.find((program) => program.id === id);
    if (!programToDelete) {
      return;
    }

    try {
      await deleteStoredProgram(id);
      setPrograms((prev) => prev.filter((program) => program.id !== id));
      if (directoryHandle && directoryPermission === "granted") {
        try {
          await directoryHandle.removeEntry(programToDelete.storedFileName);
        } catch (fileError) {
          console.warn("⚠️ Could not remove stored LED file", fileError);
        }
      }
      setFeedback({
        type: "success",
        message: "Program deleted. प्रोग्राम हटाया गया.",
      });
      console.log("🗑️ Program deleted", { id });
    } catch (error) {
      console.error("❌ Delete failed", error);
      setFeedback({
        type: "error",
        message: "Could not delete. हटाया नहीं जा सका.",
      });
    }
  };

  const handleCopyToSdCard = async (program: Program) => {
    if (!("showDirectoryPicker" in window)) {
      window.alert("Browser does not support direct SD card access.\nकृपया Chrome या Edge का इस्तेमाल करें।");
      return;
    }

    let writable: FileSystemWritableFileStream | null = null;

    try {
      const sourceDirectory = await ensureDirectoryAccess();
      if (!sourceDirectory) {
        return;
      }

      const sourceFileHandle = await sourceDirectory.getFileHandle(program.storedFileName, { create: false });
      const sourceFile = await sourceFileHandle.getFile();

      const sdHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      const targetFileHandle = await sdHandle.getFileHandle("00_program.led", { create: true });
      writable = await targetFileHandle.createWritable();

      setCopyStatuses((prev) => ({
        ...prev,
        [program.id]: { status: "copying", progress: 0 },
      }));

      const reader = sourceFile.stream().getReader();
      const totalBytes = Math.max(sourceFile.size, 1);
      let bytesWritten = 0;

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          await writable.write(value);
          bytesWritten += value.length;
          const progress = Math.min(100, Math.round((bytesWritten / totalBytes) * 100));
          setCopyStatuses((prev) => ({
            ...prev,
            [program.id]: { status: "copying", progress },
          }));
        }
      }

      await writable.close();
      writable = null;

      setCopyStatuses((prev) => ({
        ...prev,
        [program.id]: { status: "success", progress: 100 },
      }));
      window.alert(
        "Copied to SD card root as 00_program.led.\nSD कार्ड में 00_program.led नाम से कॉपी हो गया।"
      );
      console.log("💾 Program copied to SD card", { id: program.id, directory: sdHandle.name });

      window.setTimeout(() => {
        setCopyStatuses((prev) => {
          const entry = prev[program.id];
          if (!entry || entry.status === "copying") {
            return prev;
          }
          const { [program.id]: _removed, ...rest } = prev;
          return rest;
        });
      }, 4000);
    } catch (error) {
      console.error("❌ Copy to SD card failed", error);
      if (writable) {
        try {
          await writable.abort();
        } catch (abortError) {
          console.warn("⚠️ Could not abort write stream", abortError);
        }
      }
      setCopyStatuses((prev) => ({
        ...prev,
        [program.id]: { status: "error", progress: 0 },
      }));
      window.alert("Could not copy to SD card. SD कार्ड में कॉपी नहीं हो पाया।");

      window.setTimeout(() => {
        setCopyStatuses((prev) => {
          const entry = prev[program.id];
          if (!entry || entry.status === "copying") {
            return prev;
          }
          const { [program.id]: _removed, ...rest } = prev;
          return rest;
        });
      }, 5000);
    }
  };

  const handleClearAll = async () => {
    const password = window.prompt(
      "Danger! Refresh cache will delete every saved program.\nखतरा! कैश रीफ्रेश करने से सारे प्रोग्राम हट जाएंगे।\n\nEnter password to continue."
    );
    if (password === null) {
      console.log("⚠️ Cache refresh cancelled before password entry");
      return;
    }
    if (password !== REFRESH_PASSWORD) {
      window.alert("Incorrect password. गलत पासवर्ड।");
      console.warn("⚠️ Incorrect password for cache refresh");
      return;
    }

    const confirmed = window.confirm(
      "This will erase the entire catalog. Are you sure?\nयह पूरा कैटलॉग हटा देगा। क्या आप पक्का हैं?"
    );
    if (!confirmed) {
      return;
    }

    try {
      await clearStoredPrograms();
      if (directoryHandle && directoryPermission === "granted") {
        await Promise.allSettled(
          programs.map(async (program) => {
            try {
              await directoryHandle.removeEntry(program.storedFileName);
            } catch (error) {
              console.warn("⚠️ Could not remove file during clear", error);
            }
          })
        );
      }
      setPrograms([]);
      setFeedback({
        type: "success",
        message: "All programs cleared. सारे प्रोग्राम हटाए गए.",
      });
      console.log("🧹 All programs cleared");
    } catch (error) {
      console.error("❌ Clear all failed", error);
      setFeedback({
        type: "error",
        message: "Could not clear data. डेटा साफ नहीं हुआ.",
      });
    }
  };

  const isViewTab = activeTab === "view";
  const hasPrograms = programs.length > 0;
  const isEditing = editingProgramId !== null;
  const editingProgram = isEditing
    ? programs.find((program) => program.id === editingProgramId) ?? null
    : null;
  const trimmedSearchTerm = searchTerm.trim();
  const filteredPrograms = useMemo(() => {
    const normalized = trimmedSearchTerm.toLowerCase();
    if (!normalized) {
      return programs;
    }

    return programs.filter((program) => {
      const haystack = `${program.name} ${program.originalLedName} ${program.description}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [programs, trimmedSearchTerm]);

  const isGridView = catalogView === "grid";
  const isListView = !isGridView;
  const hasFilteredPrograms = filteredPrograms.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-primary px-4 py-6 text-primary-foreground shadow-md">
        <div className="relative mx-auto flex max-w-4xl flex-col gap-1 text-center sm:text-left">
          <button
            type="button"
            className="hidden-troubleshoot-button absolute -top-1 -right-1 text-xs text-primary-foreground/80"
            onClick={handleClearAll}
            aria-label="Clear all data"
          >
            Reset
          </button>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Bansal Lights - LED Catalog</h1>
          <p className="text-lg text-primary-foreground/90">Keep your LED programs organised.</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-6 pb-20">
        {isFileSystemSupported ? (
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border bg-muted/40 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              {directoryPermission === "granted" ? (
                <FolderCheck className="mt-1 h-6 w-6 text-green-600" aria-hidden="true" />
              ) : (
                <FolderX className="mt-1 h-6 w-6 text-amber-600" aria-hidden="true" />
              )}
              <div className="text-sm text-foreground">
                <p className="font-semibold">
                  {directoryPermission === "granted"
                    ? `Folder connected: ${directoryHandle?.name}`
                    : "Choose a folder to store LED files (LED फाइल सेव करने का फोल्डर चुनें)"}
                </p>
                <p className="text-muted-foreground">
                  Files stay safely in that folder. When prompted, allow read & write access.
                </p>
                {hasPersistentStorage !== null && (
                  <p
                    className={`space-y-0.5 text-xs ${
                      hasPersistentStorage ? "text-green-600" : "text-amber-600"
                    }`}
                  >
                    {hasPersistentStorage ? (
                      <>
                        Persistent storage enabled.
                        <span className="block text-[0.7rem] opacity-90">
                          कैटलॉग सुरक्षित रहेगा।
                        </span>
                      </>
                    ) : (
                      <>
                        If prompted, allow "Store on this device" so the catalog stays safe.
                        <span className="block text-[0.7rem] opacity-90">
                          अगर पूछा जाए तो "Store on this device" अनुमति दें ताकि कैटलॉग सुरक्षित रहे।
                        </span>
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void ensureDirectoryAccess({ showSuccessMessage: true });
              }}
            >
              {directoryPermission === "granted"
                ? "Change Folder (फोल्डर बदलें)"
                : "Connect Folder (फोल्डर जोड़ें)"}
            </Button>
          </div>
        ) : (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
            Your browser does not support this feature.
            <span className="block text-sm">कृपया Chrome या Edge (Desktop/Android) का इस्तेमाल करें।</span>
          </div>
        )}

        <div className="mb-6 flex flex-col gap-2 rounded-2xl bg-card p-2 shadow-sm sm:flex-row">
          <Button
            type="button"
            variant={isViewTab ? "primary" : "ghost"}
            className="w-full sm:flex-1"
            onClick={() => setActiveTab("view")}
            aria-pressed={isViewTab}
          >
            📂 View Catalog
          </Button>
          <Button
            type="button"
            variant={!isViewTab ? "primary" : "ghost"}
            className="w-full sm:flex-1"
            onClick={() => setActiveTab("add")}
            aria-pressed={!isViewTab}
          >
            ➕ Add New Program
          </Button>
        </div>

        {feedback && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-base ${
              feedback.type === "success"
                ? "border-green-200 bg-green-50 text-green-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
            role="status"
            aria-live="polite"
          >
            {feedback.message}
          </div>
        )}

        {isViewTab ? (
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-semibold">
                Saved Programs
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  Total: {programs.length}
                </span>
              </h2>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex items-center gap-2">
                  <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
                    Layout
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={isGridView ? "primary" : "ghost"}
                      aria-pressed={isGridView}
                      onClick={() => setCatalogView("grid")}
                      className="px-3"
                    >
                      <LayoutGrid className="h-5 w-5" aria-hidden="true" />
                      <span className="hidden sm:inline">Grid</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={isListView ? "primary" : "ghost"}
                      aria-pressed={isListView}
                      onClick={() => setCatalogView("list")}
                      className="px-3"
                    >
                      <List className="h-5 w-5" aria-hidden="true" />
                      <span className="hidden sm:inline">List</span>
                    </Button>
                  </div>
                </div>
                <Input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by name or description"
                  className="w-full sm:w-64"
                  aria-label="Search programs"
                />
              </div>
            </div>
            {isLoadingPrograms ? (
              <Card className="border border-dashed border-border bg-card text-muted-foreground">
                <CardContent className="space-y-4 py-10 text-center text-base">
                  <p>Loading catalog…</p>
                </CardContent>
              </Card>
            ) : hasPrograms ? (
              hasFilteredPrograms ? (
                <div
                  className={
                    isGridView ? "grid gap-5 grid-cols-1" : "flex flex-col gap-5"
                  }
                >
                  {filteredPrograms.map((program) => {
                    const copyStatus = copyStatuses[program.id];
                    const isCopying = copyStatus?.status === "copying";
                    const formattedFileSize =
                      program.fileSizeBytes !== undefined && program.fileSizeBytes !== null
                        ? formatFileSize(program.fileSizeBytes)
                        : null;
                    const sizeDisplay =
                      formattedFileSize ??
                      (directoryPermission === "granted"
                        ? "Size unavailable. (आकार उपलब्ध नहीं।)"
                        : "Connect a folder to view size. (फोल्डर कनेक्ट करें।)");

                    if (isGridView) {
                      return (
                        <Card
                          key={program.id}
                          className="flex flex-col overflow-hidden border border-border bg-card"
                        >
                          {program.photoDataUrl ? (
                            <img
                              src={program.photoDataUrl}
                              alt={`${program.name} preview`}
                              className="h-48 w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-48 w-full items-center justify-center bg-muted text-6xl text-muted-foreground/70">
                              💡
                            </div>
                          )}
                          <CardContent className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                            <div className="space-y-2">
                              <h3 className="text-xl font-semibold text-foreground">{program.name}</h3>
                              <div className="space-y-1 text-sm text-muted-foreground">
                                <p>
                                  <span className="font-medium text-foreground">Uploaded:</span>{" "}
                                  {new Date(program.dateAdded).toLocaleString()}
                                </p>
                                <p>
                                  <span className="font-medium text-foreground">File:</span>{" "}
                                  {program.originalLedName}
                                </p>
                                <p>
                                  <span className="font-medium text-foreground">Size:</span>{" "}
                                  {sizeDisplay}
                                </p>
                              </div>
                            </div>
                            {program.description && (
                              <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-base text-foreground leading-relaxed">
                                {program.description}
                              </p>
                            )}
                            <div className="mt-auto flex flex-col gap-3">
                              <Button
                                type="button"
                                variant="success"
                                onClick={() => handleCopyToSdCard(program)}
                                className="h-auto flex-wrap gap-2 whitespace-normal py-3 text-center text-base shadow-md"
                                disabled={isCopying}
                              >
                                <HardDrive className="h-6 w-6 flex-shrink-0 text-white" aria-hidden="true" />
                                <span className="leading-tight">
                                  {isCopying
                                    ? "Copying… (कॉपी जारी…)"
                                    : "Copy to SD Card (SD कार्ड में कॉपी करें)"}
                                </span>
                              </Button>
                              {copyStatus && (
                                <div className="space-y-1 rounded-xl border border-border bg-muted/40 p-3" role="status" aria-live="polite">
                                  <div className="h-2 w-full rounded-full bg-muted">
                                    <div
                                      className={`h-full rounded-full ${
                                        copyStatus.status === "error" ? "bg-red-500" : "bg-emerald-500"
                                      }`}
                                      style={{ width: `${copyStatus.progress}%` }}
                                    />
                                  </div>
                                  <p className="text-sm font-medium text-foreground">
                                    {copyStatus.status === "copying"
                                      ? `Copying… ${copyStatus.progress}%`
                                      : copyStatus.status === "success"
                                      ? "Copied successfully! (कॉपी हो गया।)"
                                      : "Copy failed. (कॉपी नहीं हो पाया।)"}
                                  </p>
                                </div>
                              )}
                            </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => handleDownload(program)}
                                  className="flex-1 min-w-[140px]"
                                >
                                  <Download className="mr-2 h-5 w-5" aria-hidden="true" />
                                  Download
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingProgramId(program.id);
                                    setFormData({
                                      programName: program.name,
                                      ledFile: null,
                                      description: program.description ?? "",
                                      photoFile: null,
                                    });
                                    setActiveTab("add");
                                    setShouldRemovePhoto(false);
                                  }}
                                  className="flex-1 min-w-[140px]"
                                >
                                  <Pencil className="mr-2 h-5 w-5" aria-hidden="true" />
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => handleDelete(program.id)}
                                  className="flex-1 min-w-[140px] border border-border text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="mr-2 h-5 w-5 text-destructive" aria-hidden="true" />
                                  Delete
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                    }

                    return (
                      <Card key={program.id} className="border border-border bg-card">
                        <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-lg font-semibold text-foreground">{program.name}</p>
                              <p className="text-sm text-muted-foreground">Size: {sizeDisplay}</p>
                            </div>
                            <Button
                              type="button"
                              size="icon"
                              variant="success"
                              onClick={() => handleCopyToSdCard(program)}
                              disabled={isCopying}
                              className="h-10 w-10 shadow-md"
                              aria-label={`Copy ${program.name} to SD card (SD कार्ड में कॉपी करें)`}
                            >
                              <HardDrive className="h-5 w-5 text-white" aria-hidden="true" />
                              <span className="sr-only">Copy to SD Card (SD कार्ड में कॉपी करें)</span>
                            </Button>
                          </div>
                          {copyStatus && (
                            <div className="space-y-1 rounded-xl border border-border bg-muted/40 p-3" role="status" aria-live="polite">
                              <div className="h-2 w-full rounded-full bg-muted">
                                <div
                                  className={`h-full rounded-full ${
                                    copyStatus.status === "error" ? "bg-red-500" : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${copyStatus.progress}%` }}
                                />
                              </div>
                              <p className="text-sm font-medium text-foreground">
                                {copyStatus.status === "copying"
                                  ? `Copying… ${copyStatus.progress}%`
                                  : copyStatus.status === "success"
                                  ? "Copied successfully! (कॉपी हो गया।)"
                                  : "Copy failed. (कॉपी नहीं हो पाया।)"}
                            </p>
                          </div>
                        )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="border border-dashed border-border bg-card text-muted-foreground">
                  <CardContent className="space-y-4 py-10 text-center text-base">
                    <p className="text-xl text-foreground">No results found.</p>
                    <p>
                      No programs match "{trimmedSearchTerm}". Try adjusting the spelling.
                      <span className="mt-1 block text-sm text-muted-foreground">
                        "{trimmedSearchTerm}" के लिए कोई प्रोग्राम नहीं मिला। स्पेलिंग बदलकर देखें।
                      </span>
                    </p>
                  </CardContent>
                </Card>
              )
            ) : (
              <Card className="border border-dashed border-border bg-card text-muted-foreground">
                <CardContent className="space-y-4 py-10 text-center text-base">
                  <p className="text-xl text-foreground">💡 No programs saved yet.</p>
                  <p>
                    Use the button below to add a program, download the file, and copy it to your SD card.
                    <span className="mt-1 block text-sm text-muted-foreground">
                      नीचे वाले बटन से नया प्रोग्राम जोड़ें। फाइल डाउनलोड करके SD कार्ड में कॉपी करें।
                    </span>
                  </p>
                  <Button type="button" onClick={() => setActiveTab("add")}> 
                    ➕ Add Program
                  </Button>
                </CardContent>
              </Card>
            )}
            <div className="mt-6 flex justify-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 focus-visible:ring-red-600"
                onClick={handleClearAll}
                title="Delete Everything (Dangerous)"
                aria-label="Delete everything (dangerous) — सब हटाएं"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete Everything
              </Button>
            </div>
          </section>
        ) : (
          <Card className="border border-border bg-card shadow-md">
            <CardHeader className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <Pencil className="h-7 w-7 text-primary" aria-hidden="true" />
                ) : (
                  <PlusCircle className="h-7 w-7 text-primary" aria-hidden="true" />
                )}
                <CardTitle>{isEditing ? "Edit Program" : "Add New Program"}</CardTitle>
              </div>
              <CardDescription className="text-base text-muted-foreground">
                {isEditing ? (
                  <>
                    Update details or add a photo. Leave fields blank to keep current values.
                    <span className="mt-1 block text-sm text-muted-foreground/90">
                      बदलाव करें या फोटो जोड़ें। खाली छोड़ने पर पुरानी जानकारी बनी रहेगी।
                    </span>
                  </>
                ) : (
                  <>
                    Choose an LED file and save it. Everything stays safely on your device.
                    <span className="mt-1 block text-sm text-muted-foreground/90">
                      LED फाइल चुनें और सेव करें। सब कुछ आपके फोन में सुरक्षित रहेगा।
                    </span>
                  </>
                )}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="programName" className="flex flex-col gap-0.5">
                    <span>Program Name *</span>
                    <span className="text-sm font-normal text-muted-foreground">प्रोग्राम नाम</span>
                  </Label>
                  <Input
                    id="programName"
                    name="programName"
                    value={formData.programName}
                    onChange={handleTextChange}
                    maxLength={50}
                    required
                    placeholder="e.g., Wedding Entry"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="flex flex-col gap-0.5">
                    <span>
                      LED File (.led)
                      {isEditing ? " (optional)" : " *"}
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">
                      LED फाइल (.led){isEditing ? " (वैकल्पिक)" : ""}
                    </span>
                  </Label>
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 px-4 py-6 text-center text-muted-foreground">
                    <FilePlus2 className="mb-2 h-10 w-10 text-primary" aria-hidden="true" />
                    <span className="mb-1 text-base font-semibold text-foreground">Tap to choose LED file</span>
                    <span className="text-sm text-muted-foreground/80">LED फाइल चुनें</span>
                    <span className="mt-2 text-xs text-muted-foreground/80">
                      {isEditing ? (
                        <>
                          Leave blank to keep the current file.
                          <span className="block text-[0.7rem] text-muted-foreground/90">
                            वर्तमान फाइल रखने के लिए खाली छोड़ें।
                          </span>
                        </>
                      ) : (
                        <>
                          Only .led files are accepted.
                          <span className="block text-[0.7rem] text-muted-foreground/90">
                            सिर्फ .led फाइल स्वीकार की जाएगी।
                          </span>
                        </>
                      )}
                    </span>
                    <input type="file" accept=".led" onChange={handleLedFileChange} className="sr-only" />
                  </label>
                  {isEditing && editingProgram?.originalLedName && !formData.ledFile && (
                    <p className="rounded-xl border border-border bg-muted/40 px-4 py-2 text-sm text-foreground">
                      Current file: {editingProgram.originalLedName}
                    </p>
                  )}
                  {formData.ledFile && (
                    <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
                      ✅ File ready: {formData.ledFile.name}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="description" className="flex flex-col gap-0.5">
                    <span>Description (optional)</span>
                    <span className="text-sm font-normal text-muted-foreground">विवरण (वैकल्पिक)</span>
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleTextChange}
                    maxLength={200}
                    rows={3}
                    placeholder="e.g., Red-white flashing"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="flex flex-col gap-0.5">
                    <span>Photo (optional)</span>
                    <span className="text-sm font-normal text-muted-foreground">फोटो (वैकल्पिक)</span>
                  </Label>
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 px-4 py-6 text-center text-muted-foreground">
                    <ImageIcon className="mb-2 h-10 w-10 text-primary" aria-hidden="true" />
                    <span className="mb-1 text-base font-semibold text-foreground">Add photo</span>
                    <span className="text-sm text-muted-foreground/80">फोटो जोड़ें</span>
                    <span className="mt-2 text-xs text-muted-foreground/80">
                      JPG/PNG, max 2MB
                      <span className="block text-[0.7rem] text-muted-foreground/90">JPG/PNG, अधिकतम 2MB</span>
                    </span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg"
                      onChange={handlePhotoChange}
                      className="sr-only"
                    />
                  </label>
                  {isEditing && editingProgram?.photoDataUrl && !shouldRemovePhoto && !formData.photoFile && (
                    <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm">
                      <span className="font-semibold text-foreground">Current photo</span>
                      <img
                        src={editingProgram.photoDataUrl}
                        alt={`${editingProgram.name} current photo`}
                        className="max-h-48 w-full rounded-lg object-cover"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="self-start text-red-600 hover:text-red-700"
                        onClick={() => setShouldRemovePhoto(true)}
                      >
                        Remove photo (फोटो हटाएं)
                      </Button>
                    </div>
                  )}
                  {shouldRemovePhoto && !formData.photoFile && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
                      <span>
                        Photo will be removed on save.
                        <span className="ml-1 text-red-600/80">फोटो सेव करते समय हट जाएगी।</span>
                      </span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShouldRemovePhoto(false)}>
                        Keep photo (फोटो रखें)
                      </Button>
                    </div>
                  )}
                  {formData.photoFile && (
                    <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
                      📷 Photo ready: {formData.photoFile.name}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="submit" disabled={isSaving}>
                    {isEditing ? "💾 Update (अपडेट करें)" : "💾 Save (सेव करें)"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => handleCancel("user")}>
                    ✖️ Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

export default App;
