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
  BookOpenCheck,
  FilePlus2,
  FolderCheck,
  FolderX,
  HardDrive,
  Pencil,
  LayoutGrid,
  List,
  FolderOpen,
  Instagram,
  Upload,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";
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
const COPIED_LED_FILENAME = "00_program.led";
const COPIED_NOTE_FILENAME = (() => {
  const extensionIndex = COPIED_LED_FILENAME.lastIndexOf(".");
  if (extensionIndex <= 0) {
    return `${COPIED_LED_FILENAME}.txt`;
  }
  return `${COPIED_LED_FILENAME.slice(0, extensionIndex)}.txt`;
})();

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

type ExportedProgramMetadata = {
  id?: string;
  name?: string;
  description?: string;
  dateAdded?: string;
  originalLedName?: string;
  storedFileName?: string;
  exportedLedFileName?: string | null;
  fileSizeBytes?: number | null;
  photoDataUrl?: string | null;
};

type CatalogExportMetadata = {
  exportedAt?: string;
  programCount?: number;
  programs?: ExportedProgramMetadata[];
};

type BilingualTextProps = {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  align?: "start" | "center";
  className?: string;
  secondaryClassName?: string;
};

function BilingualText({
  primary,
  secondary,
  align = "center",
  className,
  secondaryClassName,
}: BilingualTextProps): JSX.Element {
  return (
    <span
      className={cn(
        "flex flex-col leading-tight",
        align === "start" ? "items-start text-left" : "items-center text-center",
        className
      )}
    >
      <span>{primary}</span>
      {secondary ? (
        <span className={cn("text-sm font-normal text-muted-foreground", secondaryClassName)}>{secondary}</span>
      ) : null}
    </span>
  );
}

function App(): JSX.Element {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [formData, setFormData] = useState<ProgramFormState>(getEmptyForm);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"view" | "add" | "tutorial">("view");
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [shouldRemovePhoto, setShouldRemovePhoto] = useState(false);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [directoryPermission, setDirectoryPermission] = useState<PermissionState | null>(null);
  const [isFileSystemSupported, setIsFileSystemSupported] = useState(false);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(true);
  const [hasPersistentStorage, setHasPersistentStorage] = useState<boolean | null>(null);
  const [catalogView, setCatalogView] = useState<"grid" | "list">("list");
  const [copyStatuses, setCopyStatuses] = useState<Record<string, CopyStatus>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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
      link.download = COPIED_LED_FILENAME;
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

  const buildProgramMetadataNote = (program: Program): string => {
    const header = [
      "LED Program Metadata",
      "====================",
      "",
    ].join("\n");

    const date = new Date(program.dateAdded);
    const localizedDate = Number.isNaN(date.getTime())
      ? program.dateAdded
      : `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

    const lines = [
      header,
      `Program Name: ${program.name || "Not provided"}`,
      `Original LED File: ${program.originalLedName}`,
      `Copied As: ${COPIED_LED_FILENAME}`,
      `Description: ${program.description ? program.description : "(none)"}`,
      `Date Added: ${localizedDate}`,
    ];

    if (program.fileSizeBytes !== undefined && program.fileSizeBytes !== null) {
      lines.push(`File Size: ${formatFileSize(program.fileSizeBytes)}`);
    }

    lines.push("", "This note is auto-generated by the LED Catalog app.");

    return lines.join("\n");
  };

  const handleCopyToSdCard = async (program: Program) => {
    if (!("showDirectoryPicker" in window)) {
      window.alert("Browser does not support direct SD card access.\nकृपया Chrome या Edge का इस्तेमाल करें।");
      return;
    }

    let writable: FileSystemWritableFileStream | null = null;
    let metadataWritable: FileSystemWritableFileStream | null = null;

    try {
      const sourceDirectory = await ensureDirectoryAccess();
      if (!sourceDirectory) {
        return;
      }

      const sourceFileHandle = await sourceDirectory.getFileHandle(program.storedFileName, { create: false });
      const sourceFile = await sourceFileHandle.getFile();

      const sdHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      const targetFileHandle = await sdHandle.getFileHandle(COPIED_LED_FILENAME, { create: true });
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

      try {
        const metadataContent = buildProgramMetadataNote(program);
        const metadataHandle = await sdHandle.getFileHandle(COPIED_NOTE_FILENAME, { create: true });
        metadataWritable = await metadataHandle.createWritable();
        await metadataWritable.write(metadataContent);
        await metadataWritable.close();
        metadataWritable = null;
      } catch (metadataError) {
        console.error("⚠️ Could not write metadata note to SD card", metadataError);
        if (metadataWritable) {
          try {
            await metadataWritable.abort();
          } catch (abortMetadataError) {
            console.warn("⚠️ Could not abort metadata write stream", abortMetadataError);
          }
        }
        setCopyStatuses((prev) => ({
          ...prev,
          [program.id]: { status: "error", progress: 100 },
        }));
        window.alert(
          "LED file copied but metadata note could not be saved.\nLED फाइल कॉपी हो गई पर नोट सेव नहीं हो पाया।"
        );

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
        return;
      }

      setCopyStatuses((prev) => ({
        ...prev,
        [program.id]: { status: "success", progress: 100 },
      }));
      window.alert(
        `Copied to SD card as ${COPIED_LED_FILENAME} with details in ${COPIED_NOTE_FILENAME}.\n`
          + `SD कार्ड में ${COPIED_LED_FILENAME} कॉपी हुआ और नोट ${COPIED_NOTE_FILENAME} में सेव हुआ।`
      );
      console.log("💾 Program copied to SD card", {
        id: program.id,
        directory: sdHandle.name,
        metadataFile: COPIED_NOTE_FILENAME,
      });

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
      if (metadataWritable) {
        try {
          await metadataWritable.abort();
        } catch (abortMetadataError) {
          console.warn("⚠️ Could not abort metadata write stream", abortMetadataError);
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

  const handleExportCatalog = async () => {
    if (programs.length === 0) {
      setFeedback({
        type: "error",
        message: "No programs to export. एक्सपोर्ट करने के लिए कोई प्रोग्राम नहीं है.",
      });
      return;
    }

    if (!("showDirectoryPicker" in window)) {
      setFeedback({
        type: "error",
        message: "Browser does not support export. ब्राउज़र एक्सपोर्ट नहीं कर सकता.",
      });
      return;
    }

    setIsExporting(true);

    try {
      const sourceDirectory = await ensureDirectoryAccess();
      if (!sourceDirectory) {
        return;
      }

      const exportRoot = await window.showDirectoryPicker({ mode: "readwrite" });
      const timestamp = new Date();
      const folderName = `led-catalog-export-${timestamp.toISOString().replace(/[:.]/g, "-")}`;
      const exportDirectory = await exportRoot.getDirectoryHandle(folderName, { create: true });

      const exportedPrograms: Array<{
        id: string;
        name: string;
        description: string;
        dateAdded: string;
        originalLedName: string;
        storedFileName: string;
        exportedLedFileName: string | null;
        fileSizeBytes: number | null | undefined;
        photoDataUrl: string | null;
        notes?: string;
      }> = [];

      const usedFileNames = new Set<string>();

      const getExportFileName = (program: Program, index: number): string => {
        const defaultBase = program.originalLedName
          ? program.originalLedName.replace(/\.[^.]+$/, "")
          : program.name || `program-${index + 1}`;
        const sanitizedBase = sanitizeFileName(defaultBase) || `program-${index + 1}`;
        const extensionMatch = program.originalLedName.match(/\.[^.]+$/);
        const extension = extensionMatch ? extensionMatch[0] : ".led";

        let candidate = `${sanitizedBase}${extension}`;
        let suffix = 2;
        while (usedFileNames.has(candidate)) {
          candidate = `${sanitizedBase}-${suffix}${extension}`;
          suffix += 1;
        }
        usedFileNames.add(candidate);
        return candidate;
      };

      for (const [index, program] of programs.entries()) {
        let exportedLedFileName: string | null = null;
        let ledSize: number | null | undefined = program.fileSizeBytes;
        let notes: string | undefined;

        try {
          const sourceFileHandle = await sourceDirectory.getFileHandle(program.storedFileName, { create: false });
          const sourceFile = await sourceFileHandle.getFile();
          ledSize = sourceFile.size;
          const exportFileName = getExportFileName(program, index);
          const targetFileHandle = await exportDirectory.getFileHandle(exportFileName, { create: true });
          const writable = await targetFileHandle.createWritable();
          await writable.write(sourceFile);
          await writable.close();
          exportedLedFileName = exportFileName;
        } catch (error) {
          console.warn("⚠️ Failed to export LED file", { id: program.id, error });
          notes = "LED file missing or permission denied";
        }

        exportedPrograms.push({
          id: program.id,
          name: program.name,
          description: program.description,
          dateAdded: program.dateAdded,
          originalLedName: program.originalLedName,
          storedFileName: program.storedFileName,
          exportedLedFileName,
          fileSizeBytes: ledSize,
          photoDataUrl: program.photoDataUrl,
          ...(notes ? { notes } : {}),
        });
      }

      const metadataHandle = await exportDirectory.getFileHandle("catalog.json", { create: true });
      const metadataWritable = await metadataHandle.createWritable();
      const metadata = {
        exportedAt: new Date().toISOString(),
        programCount: exportedPrograms.length,
        instructions:
          "Copy this entire folder to the new device and open catalog.json to view program details.",
        programs: exportedPrograms,
      };
      await metadataWritable.write(`${JSON.stringify(metadata, null, 2)}\n`);
      await metadataWritable.close();

      let syncOutcome: "skipped" | "success" | "error" = "skipped";

      const isHttpContext =
        typeof window !== "undefined" && window.location?.protocol !== "file:";

      if (typeof fetch === "function" && isHttpContext) {
        try {
          const syncPayload = {
            exportedAt: metadata.exportedAt,
            programCount: metadata.programCount,
            programs: exportedPrograms.map(
              ({
                id,
                name,
                description,
                dateAdded,
                originalLedName,
                storedFileName,
                exportedLedFileName,
                fileSizeBytes,
                photoDataUrl,
                notes,
              }) => ({
                id,
                name,
                description,
                dateAdded,
                originalLedName,
                storedFileName,
                exportedLedFileName,
                fileSizeBytes,
                photoDataUrl,
                ...(notes ? { notes } : {}),
              })
            ),
          };

          const response = await fetch("/api/sync", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(syncPayload),
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            throw new Error(errorText || `Unexpected response status: ${response.status}`);
          }

          syncOutcome = "success";
          console.log("☁️ Catalog metadata synced to Cloudflare", {
            exportedAt: metadata.exportedAt,
            programCount: metadata.programCount,
          });
        } catch (error) {
          syncOutcome = "error";
          console.error("⚠️ Catalog metadata sync failed", error);
        }
      } else {
        console.info("ℹ️ Skipping cloud sync in offline context");
      }

      let feedbackMessage = `Export complete in folder "${folderName}". एक्सपोर्ट पूरा हुआ।`;

      if (syncOutcome === "success") {
        feedbackMessage = `Export complete in folder "${folderName}" and synced online. एक्सपोर्ट पूरा हुआ और डेटा ऑनलाइन सेव हो गया।`;
      } else if (syncOutcome === "error") {
        feedbackMessage = `Export complete in folder "${folderName}" but online sync failed. एक्सपोर्ट पूरा हुआ पर ऑनलाइन सिंक नहीं हो पाया।`;
      }

      setFeedback({
        type: "success",
        message: feedbackMessage,
      });

      console.log("📦 Catalog exported", { folderName, programCount: programs.length });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.log("⚠️ Catalog export cancelled by user");
        return;
      }
      console.error("❌ Catalog export failed", error);
      setFeedback({
        type: "error",
        message: "Export failed. एक्सपोर्ट नहीं हो पाया.",
      });
  } finally {
    setIsExporting(false);
  }
  };

  const handleImportCatalog = async () => {
    if (!isFileSystemSupported) {
      setFeedback({
        type: "error",
        message: "Browser unsupported. ब्राउज़र यह फीचर नहीं चला सकता.",
      });
      return;
    }

    setIsImporting(true);

    try {
      const importDirectory = await window.showDirectoryPicker({
        id: "led-catalog-import",
        mode: "read",
      });

      let metadataHandle: FileSystemFileHandle;
      try {
        metadataHandle = await importDirectory.getFileHandle("catalog.json", { create: false });
      } catch (error) {
        setFeedback({
          type: "error",
          message: "catalog.json missing in backup. बैकअप में catalog.json नहीं मिला.",
        });
        return;
      }

      const metadataFile = await metadataHandle.getFile();
      const metadataText = await metadataFile.text();

      let metadata: CatalogExportMetadata;
      try {
        metadata = JSON.parse(metadataText) as CatalogExportMetadata;
      } catch (error) {
        setFeedback({
          type: "error",
          message: "Backup file is corrupted. बैकअप फाइल सही नहीं है.",
        });
        return;
      }

      const exportedPrograms = Array.isArray(metadata.programs) ? metadata.programs : [];

      if (exportedPrograms.length === 0) {
        setFeedback({
          type: "error",
          message: "Backup is empty. बैकअप खाली है.",
        });
        return;
      }

      const normalizeString = (value: unknown): string | null =>
        typeof value === "string" ? value.trim() : null;

      const existingIds = new Set(programs.map((program) => program.id));
      const skippedExisting: string[] = [];
      const skippedMissing: string[] = [];
      const candidates: Array<{ entry: ExportedProgramMetadata; file: File }> = [];

      for (const entry of exportedPrograms) {
        const displayName = normalizeString(entry.name) ?? "Imported Program";
        const candidateFileName =
          normalizeString(entry.exportedLedFileName) ??
          normalizeString(entry.originalLedName) ??
          normalizeString(entry.storedFileName);

        if (!candidateFileName) {
          skippedMissing.push(displayName);
          continue;
        }

        let file: File;
        try {
          const fileHandle = await importDirectory.getFileHandle(candidateFileName, { create: false });
          file = await fileHandle.getFile();
        } catch (error) {
          console.warn("⚠️ Missing LED file during import", { candidateFileName, error });
          skippedMissing.push(displayName);
          continue;
        }

        const entryId = normalizeString(entry.id);
        if (entryId && existingIds.has(entryId)) {
          skippedExisting.push(displayName);
          continue;
        }

        candidates.push({ entry, file });
      }

      if (candidates.length === 0) {
        let message = "No new programs to import. नया डेटा उपलब्ध नहीं है.";

        if (skippedMissing.length > 0 && skippedExisting.length === 0) {
          message = "Files missing in backup. बैकअप में जरूरी फाइल नहीं मिली।";
        } else if (skippedExisting.length > 0 && skippedMissing.length === 0) {
          message = "All programs already in catalog. सारे प्रोग्राम पहले से मौजूद हैं.";
        } else if (skippedMissing.length > 0 && skippedExisting.length > 0) {
          message = "Nothing imported: files missing or already saved. कुछ भी इम्पोर्ट नहीं हुआ.";
        }

        setFeedback({
          type: "error",
          message,
        });
        return;
      }

      const totalBytes = candidates.reduce((sum, { file }) => sum + file.size, 0);
      const hasSpace = await ensureStorageCapacity(totalBytes);
      if (!hasSpace) {
        return;
      }

      const targetDirectory = await ensureDirectoryAccess();
      if (!targetDirectory) {
        return;
      }

      const importedPrograms: Program[] = [];
      const failedImports: string[] = [];

      for (const { entry, file } of candidates) {
        const displayName = normalizeString(entry.name) ?? file.name;
        const preferredId = normalizeString(entry.id);
        let newId =
          preferredId && !existingIds.has(preferredId)
            ? preferredId
            : `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
        while (existingIds.has(newId)) {
          newId = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
        }

        const storedFileName = `${newId}-${sanitizeFileName(file.name)}`;
        let createdFileName: string | null = null;

        try {
          const targetFileHandle = await targetDirectory.getFileHandle(storedFileName, { create: true });
          createdFileName = storedFileName;
          const writable = await targetFileHandle.createWritable();
          await writable.write(file);
          await writable.close();

          const importedProgram: Program = {
            id: newId,
            name: normalizeString(entry.name) ?? file.name.replace(/\.[^.]+$/, ""),
            description: normalizeString(entry.description) ?? "",
            dateAdded: normalizeString(entry.dateAdded) ?? new Date().toISOString(),
            originalLedName: normalizeString(entry.originalLedName) ?? file.name,
            storedFileName,
            photoDataUrl: typeof entry.photoDataUrl === "string" ? entry.photoDataUrl : null,
            fileSizeBytes: file.size,
          };

          await saveStoredProgram(importedProgram);
          existingIds.add(newId);
          importedPrograms.push(importedProgram);
        } catch (error) {
          console.error("⚠️ Failed to import program", { displayName, error });
          if (createdFileName) {
            try {
              await targetDirectory.removeEntry(createdFileName);
            } catch (cleanupError) {
              console.warn("⚠️ Could not clean up failed import file", cleanupError);
            }
          }
          failedImports.push(displayName);
        }
      }

      if (importedPrograms.length === 0) {
        const messageParts: string[] = [];
        if (failedImports.length > 0) {
          messageParts.push(
            `Could not import ${failedImports.length} program${failedImports.length === 1 ? "" : "s"}. ${failedImports.length} प्रोग्राम इम्पोर्ट नहीं हो पाए।`
          );
        }
        if (skippedMissing.length > 0) {
          messageParts.push(
            `Files missing for ${skippedMissing.length} programs. ${skippedMissing.length} प्रोग्राम की फाइल नहीं मिली।`
          );
        }
        setFeedback({
          type: "error",
          message: messageParts.join(" ") || "Import failed. इम्पोर्ट नहीं हो पाया.",
        });
        return;
      }

      setPrograms((prev) => sortPrograms([...prev, ...importedPrograms]));
      setActiveTab("view");

      const messageParts: string[] = [];
      messageParts.push(
        `Imported ${importedPrograms.length} program${importedPrograms.length === 1 ? "" : "s"}. ${importedPrograms.length} प्रोग्राम इम्पोर्ट हुए।`
      );
      if (skippedExisting.length > 0) {
        messageParts.push(
          `${skippedExisting.length} already existed. ${skippedExisting.length} पहले से सेव थे।`
        );
      }
      if (skippedMissing.length > 0) {
        messageParts.push(
          `${skippedMissing.length} files missing. ${skippedMissing.length} फाइल नहीं मिली।`
        );
      }
      if (failedImports.length > 0) {
        messageParts.push(
          `${failedImports.length} could not import. ${failedImports.length} इम्पोर्ट नहीं हो पाए।`
        );
      }

      setFeedback({
        type: skippedMissing.length > 0 || failedImports.length > 0 ? "error" : "success",
        message: messageParts.join(" "),
      });

      console.log("📥 Catalog import complete", {
        imported: importedPrograms.length,
        skippedExisting: skippedExisting.length,
        skippedMissing: skippedMissing.length,
        failed: failedImports.length,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.log("⚠️ Catalog import cancelled by user");
        return;
      }
      console.error("❌ Catalog import failed", error);
      setFeedback({
        type: "error",
        message: "Import failed. इम्पोर्ट नहीं हो पाया.",
      });
    } finally {
      setIsImporting(false);
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
  const isAddTab = activeTab === "add";
  const isTutorialTab = activeTab === "tutorial";
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
        <div className="relative mx-auto flex max-w-4xl flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <button
            type="button"
            className="hidden-troubleshoot-button absolute -top-1 -right-1 text-xs text-primary-foreground/80"
            onClick={handleClearAll}
            aria-label="Clear all data"
          >
            Reset
          </button>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Bansal Lights - LED Catalog</h1>
            <p className="text-lg text-primary-foreground/90">अपने LED प्रोग्राम्स यहाँ सेव करें</p>
          </div>
          <a
            href="https://www.instagram.com/bansallights"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 self-center rounded-full border border-primary-foreground/40 bg-primary-foreground/10 px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-foreground/20"
          >
            <Instagram className="h-5 w-5" aria-hidden="true" />
            <span>Follow @bansallights</span>
          </a>
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
                {directoryPermission === "granted" ? (
                  <p className="font-semibold">Folder connected: {directoryHandle?.name}</p>
                ) : (
                  <BilingualText
                    primary="Choose a folder to store LED files"
                    secondary="LED फाइल सेव करने का फोल्डर चुनें"
                    align="start"
                    className="font-semibold"
                    secondaryClassName="text-xs sm:text-sm text-muted-foreground"
                  />
                )}
                <p className="text-muted-foreground">
                  Files stay safely in that folder. When prompted, allow read & write access.
                </p>
                {hasPersistentStorage !== null && (
                  <p
                    className={`text-xs ${
                      hasPersistentStorage ? "text-green-600" : "text-amber-600"
                    }`}
                  >
                    {hasPersistentStorage
                      ? "Persistent storage enabled. कैटलॉग सुरक्षित रहेगा।"
                      : "अगर पूछा जाए तो \"Store on this device\" अनुमति दें ताकि कैटलॉग सुरक्षित रहे।"}
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
              {directoryPermission === "granted" ? (
                <BilingualText
                  primary="Change Folder"
                  secondary="फोल्डर बदलें"
                  secondaryClassName="text-xs text-primary/90"
                />
              ) : (
                <BilingualText
                  primary="Connect Folder"
                  secondary="फोल्डर जोड़ें"
                  secondaryClassName="text-xs text-primary/90"
                />
              )}
            </Button>
          </div>
        ) : (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
            आपका ब्राउज़र यह फीचर नहीं चला सकता। Chrome या Edge (Desktop/Android) का इस्तेमाल करें।
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Quick actions · त्वरित क्रियाएँ
              </h2>
              <BilingualText
                primary="Add new programs easily. Backup tools stay within reach without crowding the page."
                secondary="नए प्रोग्राम आसानी से जोड़ें। बैकअप विकल्प पास में रहें लेकिन पेज पर भीड़ न बनाएं।"
                align="start"
                className="text-left text-sm text-muted-foreground"
                secondaryClassName="text-xs text-muted-foreground/80"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Button
                type="button"
                variant="secondary"
                className="w-full justify-center gap-3 px-5 py-3 sm:w-auto"
                onClick={() => {
                  setActiveTab("add");
                }}
              >
                <PlusCircle className="h-5 w-5" aria-hidden="true" />
                <BilingualText
                  primary="Add Program"
                  secondary="नया प्रोग्राम जोड़ें"
                  align="start"
                  className="items-start text-left"
                  secondaryClassName="text-xs text-muted-foreground"
                />
              </Button>
              <div className="flex w-full flex-col gap-2 rounded-2xl border border-dashed border-border/70 bg-muted/40 p-3 text-left sm:w-auto sm:flex-row sm:items-center sm:gap-3 sm:p-2">
                <div className="flex flex-col text-xs font-medium uppercase tracking-wide text-muted-foreground sm:flex-row sm:items-center sm:gap-2">
                  <span>Backup tools</span>
                  <span className="text-[11px] font-normal capitalize text-muted-foreground/80 sm:text-xs">
                    बैकअप विकल्प
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 rounded-xl border border-border/60 bg-background/80 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      void handleImportCatalog();
                    }}
                    disabled={isImporting}
                    aria-busy={isImporting}
                    title={isImporting ? "Importing backup…" : "Import backup"}
                  >
                    {isImporting ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Upload className="h-5 w-5" aria-hidden="true" />
                    )}
                    <span className="sr-only">{isImporting ? "Importing…" : "Import backup · बैकअप जोड़ें"}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 rounded-xl border border-border/60 bg-background/80 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      void handleExportCatalog();
                    }}
                    disabled={isExporting}
                    aria-busy={isExporting}
                    title={isExporting ? "Exporting backup…" : "Export backup"}
                  >
                    {isExporting ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="h-5 w-5" aria-hidden="true" />
                    )}
                    <span className="sr-only">{isExporting ? "Exporting…" : "Export backup · बैकअप सेव करें"}</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mb-6">
          <div
            className="flex flex-col gap-2 rounded-2xl border border-border bg-card/80 p-3 shadow-sm sm:flex-row"
            role="tablist"
            aria-label="Catalog sections"
          >
            <Button
              type="button"
              variant="ghost"
              id="catalog-view-tab"
              role="tab"
              aria-selected={isViewTab}
              aria-controls="catalog-view-panel"
              onClick={() => setActiveTab("view")}
              className={cn(
                "w-full justify-start gap-3 rounded-xl px-4 py-3 text-base font-semibold transition sm:flex-1",
                isViewTab
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/40"
                  : "bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <FolderOpen className="h-5 w-5" aria-hidden="true" />
              <BilingualText
                primary="View Catalog"
                secondary="कैटलॉग देखें"
                align="start"
                className="items-start text-left"
                secondaryClassName={cn(
                  "text-xs",
                  isViewTab ? "text-primary-foreground/80" : "text-muted-foreground"
                )}
              />
            </Button>
            <Button
              type="button"
              variant="ghost"
              id="catalog-add-tab"
              role="tab"
              aria-selected={isAddTab}
              aria-controls="catalog-add-panel"
              onClick={() => setActiveTab("add")}
              className={cn(
                "w-full justify-start gap-3 rounded-xl px-4 py-3 text-base font-semibold transition sm:flex-1",
                isAddTab
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/40"
                  : "bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <PlusCircle className="h-5 w-5" aria-hidden="true" />
              <BilingualText
                primary="Add New Program"
                secondary="नया जोड़ें"
                align="start"
                className="items-start text-left"
                secondaryClassName={cn(
                  "text-xs",
                  isAddTab ? "text-primary-foreground/80" : "text-muted-foreground"
                )}
              />
            </Button>
            <Button
              type="button"
              variant="ghost"
              id="catalog-tutorial-tab"
              role="tab"
              aria-selected={isTutorialTab}
              aria-controls="catalog-tutorial-panel"
              onClick={() => setActiveTab("tutorial")}
              className={cn(
                "w-full justify-start gap-3 rounded-xl px-4 py-3 text-base font-semibold transition sm:flex-1",
                isTutorialTab
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/40"
                  : "bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
              <BilingualText
                primary="Step-by-Step Tutorial"
                secondary="स्टेप-बाय-स्टेप गाइड"
                align="start"
                className="items-start text-left"
                secondaryClassName={cn(
                  "text-xs",
                  isTutorialTab ? "text-primary-foreground/80" : "text-muted-foreground"
                )}
              />
            </Button>
          </div>
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

        {isViewTab && (
          <section
            id="catalog-view-panel"
            role="tabpanel"
            aria-labelledby="catalog-view-tab"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                <h2 className="text-2xl font-semibold">
                  <BilingualText
                    primary="Saved Programs"
                    secondary="सेव किए गए प्रोग्राम"
                    align="start"
                    className="items-start"
                  />
                </h2>
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                  <FolderOpen className="h-4 w-4" aria-hidden="true" />
                  <span>Total Programs: {programs.length}</span>
                </span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="hidden text-sm font-medium text-muted-foreground sm:inline">Layout:</span>
                  <div className="flex flex-wrap gap-2">
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
                  <p>Loading catalog… कैटलॉग लोड हो रहा है…</p>
                </CardContent>
              </Card>
            ) : hasPrograms ? (
              hasFilteredPrograms ? (
                <div
                  className={
                    isGridView
                      ? "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
                      : "flex flex-col gap-5"
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
                        ? "Size unavailable"
                        : "Connect folder to view size");

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
                                className="h-auto flex-wrap gap-3 whitespace-normal py-4 text-base shadow-lg shadow-emerald-200/50"
                                disabled={isCopying}
                              >
                                <HardDrive className="h-6 w-6 flex-shrink-0 text-white" aria-hidden="true" />
                                <BilingualText
                                  primary={isCopying ? "Copying…" : "Copy to SD Card"}
                                  secondary={isCopying ? "कॉपी जारी…" : "SD कार्ड में कॉपी करें"}
                                  align="start"
                                  className="gap-0.5 text-left"
                                  secondaryClassName="text-xs text-emerald-100/90"
                                />
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
                                    {copyStatus.status === "copying" ? (
                                      `Copying… ${copyStatus.progress}%`
                                    ) : copyStatus.status === "success" ? (
                                      <BilingualText
                                        primary="Copied successfully!"
                                        secondary="कॉपी हो गया।"
                                        className="items-start text-left"
                                        secondaryClassName="text-xs text-muted-foreground"
                                      />
                                    ) : (
                                      <BilingualText
                                        primary="Copy failed."
                                        secondary="कॉपी नहीं हो पाया।"
                                        className="items-start text-left"
                                        secondaryClassName="text-xs text-muted-foreground"
                                      />
                                    )}
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleDownload(program)}
                                className="w-full sm:flex-1"
                              >
                                <Download className="h-5 w-5" aria-hidden="true" />
                                <BilingualText
                                  primary="Download"
                                  secondary="डाउनलोड"
                                  align="start"
                                  className="items-start text-left"
                                  secondaryClassName="text-xs text-muted-foreground"
                                />
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
                                className="w-full sm:flex-1"
                              >
                                <Pencil className="h-5 w-5" aria-hidden="true" />
                                <BilingualText
                                  primary="Edit"
                                  secondary="एडिट"
                                  align="start"
                                  className="items-start text-left"
                                  secondaryClassName="text-xs text-muted-foreground"
                                />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleDelete(program.id)}
                                className="w-full border border-transparent text-red-600 hover:border-red-100 hover:bg-red-50 sm:flex-1"
                              >
                                <Trash2 className="h-5 w-5" aria-hidden="true" />
                                <BilingualText
                                  primary="Delete"
                                  secondary="डिलीट"
                                  align="start"
                                  className="items-start text-left"
                                  secondaryClassName="text-xs text-red-500"
                                />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }

                    return (
                      <Card key={program.id} className="border border-border bg-card">
                        <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 space-y-1">
                              <p className="truncate text-lg font-semibold text-foreground">{program.name}</p>
                              <p className="text-sm text-muted-foreground">Size: {sizeDisplay}</p>
                            </div>
                            <Button
                              type="button"
                              variant="success"
                              onClick={() => handleCopyToSdCard(program)}
                              disabled={isCopying}
                              className="h-auto w-full gap-3 px-4 py-3 text-sm shadow-lg shadow-emerald-200/50 sm:w-auto"
                              aria-label={`Copy ${program.name} to SD card`}
                            >
                              <HardDrive className="h-5 w-5 text-white" aria-hidden="true" />
                              <BilingualText
                                primary={isCopying ? "Copying…" : "Copy to SD Card"}
                                secondary={isCopying ? "कॉपी जारी…" : "SD कार्ड में कॉपी करें"}
                                align="start"
                                className="items-start text-left"
                                secondaryClassName="text-xs text-emerald-100/90"
                              />
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
                                {copyStatus.status === "copying" ? (
                                  `Copying… ${copyStatus.progress}%`
                                ) : copyStatus.status === "success" ? (
                                  <BilingualText
                                    primary="Copied successfully!"
                                    secondary="कॉपी हो गया।"
                                    className="items-start text-left"
                                    secondaryClassName="text-xs text-muted-foreground"
                                  />
                                ) : (
                                  <BilingualText
                                    primary="Copy failed."
                                    secondary="कॉपी नहीं हो पाया।"
                                    className="items-start text-left"
                                    secondaryClassName="text-xs text-muted-foreground"
                                  />
                                )}
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
                    <p className="text-xl text-foreground">कोई परिणाम नहीं मिला।</p>
                    <p>
                      "{trimmedSearchTerm}" के लिए कोई प्रोग्राम नहीं मिला। स्पेलिंग बदलकर देखें।
                    </p>
                  </CardContent>
                </Card>
              )
            ) : (
              <Card className="border border-dashed border-border bg-card text-muted-foreground">
                <CardContent className="space-y-4 py-10 text-center text-base">
                  <p className="text-xl text-foreground">💡 अभी कोई प्रोग्राम सेव नहीं है।</p>
                  <p>
                    नीचे वाले बटन से नया प्रोग्राम जोड़ें। फाइल डाउनलोड करके SD कार्ड में कॉपी करें।
                  </p>
                  <Button type="button" onClick={() => setActiveTab("add")} className="flex-col gap-1">
                    <span aria-hidden="true" className="text-2xl">➕</span>
                    <BilingualText primary="Add Program" secondary="नया जोड़ें" />
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
                aria-label="Delete everything (dangerous)"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete Everything
              </Button>
            </div>
          </section>
        )}

        {isAddTab && (
          <section
            id="catalog-add-panel"
            role="tabpanel"
            aria-labelledby="catalog-add-tab"
            className="flex flex-col"
          >
            <Card className="border border-border bg-card shadow-md">
              <CardHeader className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <Pencil className="h-7 w-7 text-primary" aria-hidden="true" />
                ) : (
                  <PlusCircle className="h-7 w-7 text-primary" aria-hidden="true" />
                )}
                <CardTitle>
                  {isEditing ? (
                    <BilingualText
                      primary="Edit Program"
                      secondary="प्रोग्राम बदलें"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-base text-muted-foreground"
                    />
                  ) : (
                    <BilingualText
                      primary="Add New Program"
                      secondary="नया प्रोग्राम जोड़ें"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-base text-muted-foreground"
                    />
                  )}
                </CardTitle>
              </div>
              <CardDescription className="text-base text-muted-foreground">
                {isEditing
                  ? "Update details or add a photo. Leave fields blank to keep current values. बदलाव करें या फोटो जोड़ें।"
                  : "LED फाइल चुनें और सेव करें। सब कुछ आपके फोन में सुरक्षित रहेगा।"}
              </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
              <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                <div className="flex flex-col gap-2">
                  <Label
                    htmlFor="programName"
                    className="space-y-1"
                  >
                    <BilingualText
                      primary="Program Name *"
                      secondary="प्रोग्राम नाम (अनिवार्य)"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-sm text-muted-foreground"
                    />
                  </Label>
                  <Input
                    id="programName"
                    name="programName"
                    value={formData.programName}
                    onChange={handleTextChange}
                    maxLength={50}
                    required
                    placeholder="e.g., Shaadi Entry"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="space-y-1">
                    <BilingualText
                      primary={isEditing ? "LED File (.led) (optional)" : "LED File (.led) *"}
                      secondary={isEditing ? "LED फाइल (.led) (वैकल्पिक)" : "LED फाइल (.led) (अनिवार्य)"}
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-sm text-muted-foreground"
                    />
                  </Label>
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 px-4 py-6 text-center text-muted-foreground">
                    <FilePlus2 className="mb-2 h-10 w-10 text-primary" aria-hidden="true" />
                    <BilingualText
                      primary="Tap to choose LED file"
                      secondary="LED फाइल चुनें"
                      className="mb-1 items-center text-base"
                      secondaryClassName="text-sm text-muted-foreground/80"
                    />
                    <BilingualText
                      primary={isEditing ? "Leave blank to keep current file." : "Only .led files are accepted."}
                      secondary={isEditing ? "पुरानी फाइल रखने के लिए खाली छोड़ें।" : "केवल .led फाइलें मान्य हैं।"}
                      className="items-center text-sm"
                      secondaryClassName="text-xs text-muted-foreground/80"
                    />
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
                  <Label htmlFor="description" className="space-y-1">
                    <BilingualText
                      primary="Description (optional)"
                      secondary="विवरण (वैकल्पिक)"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-sm text-muted-foreground"
                    />
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
                  <Label className="space-y-1">
                    <BilingualText
                      primary="Photo (optional)"
                      secondary="फोटो (वैकल्पिक)"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-sm text-muted-foreground"
                    />
                  </Label>
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 px-4 py-6 text-center text-muted-foreground">
                    <ImageIcon className="mb-2 h-10 w-10 text-primary" aria-hidden="true" />
                    <BilingualText
                      primary="Add photo"
                      secondary="फोटो जोड़ें"
                      className="mb-1 items-center text-base"
                      secondaryClassName="text-sm text-muted-foreground/80"
                    />
                    <BilingualText
                      primary="JPG/PNG, max 2MB"
                      secondary="JPG/PNG, अधिकतम 2MB"
                      className="items-center text-sm"
                      secondaryClassName="text-xs text-muted-foreground/80"
                    />
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
                        <BilingualText
                          primary="Remove photo"
                          secondary="फोटो हटाएं"
                          align="start"
                          className="items-start text-left"
                          secondaryClassName="text-xs text-red-500"
                        />
                      </Button>
                    </div>
                  )}
                  {shouldRemovePhoto && !formData.photoFile && (
                    <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
                      <BilingualText
                        primary="Photo will be removed on save."
                        secondary="फोटो सेव करते समय हट जाएगी।"
                        align="start"
                        className="items-start text-left"
                        secondaryClassName="text-xs text-red-600"
                      />
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShouldRemovePhoto(false)}>
                        <BilingualText
                          primary="Keep photo"
                          secondary="फोटो रखें"
                          align="start"
                          className="items-start text-left"
                          secondaryClassName="text-xs text-muted-foreground"
                        />
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
                  <Button type="submit" disabled={isSaving} className="gap-2">
                    <span aria-hidden="true" className="text-xl">
                      💾
                    </span>
                    {isEditing ? (
                      <BilingualText
                        primary="Update"
                        secondary="अपडेट करें"
                        align="start"
                        className="items-start text-left"
                        secondaryClassName="text-sm text-muted-foreground/80"
                      />
                    ) : (
                      <BilingualText
                        primary="Save"
                        secondary="सेव करें"
                        align="start"
                        className="items-start text-left"
                        secondaryClassName="text-sm text-muted-foreground/80"
                      />
                    )}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => handleCancel("user")} className="gap-2">
                    <span aria-hidden="true" className="text-xl">
                      ✖️
                    </span>
                    <BilingualText
                      primary="Cancel"
                      secondary="रद्द करें"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-sm text-muted-foreground/80"
                    />
                  </Button>
                </div>
              </form>
              </CardContent>
            </Card>
          </section>
        )}

        {isTutorialTab && (
          <section
            id="catalog-tutorial-panel"
            role="tabpanel"
            aria-labelledby="catalog-tutorial-tab"
            className="flex flex-col gap-6"
          >
            <Card className="border border-border bg-card shadow-md">
              <CardHeader className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <BookOpenCheck className="h-7 w-7 text-primary" aria-hidden="true" />
                  <CardTitle>
                    <BilingualText
                      primary="Step-by-Step Tutorial"
                      secondary="स्टेप-बाय-स्टेप मदद"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-base text-muted-foreground"
                    />
                  </CardTitle>
                </div>
                <CardDescription className="text-base text-muted-foreground">
                  Follow these simple steps anytime you need a refresher. जब भी जरूरत पड़े, इन आसान स्टेप्स को पढ़ें और दोहराएं।
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">
                    <BilingualText
                      primary="Add a New Program"
                      secondary="नया प्रोग्राम जोड़ें"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-base text-muted-foreground"
                    />
                  </h3>
                  <ol className="space-y-3 text-base text-muted-foreground">
                    <li className="rounded-xl border border-border/60 bg-muted/50 p-4">
                      <BilingualText
                        primary="Open the “Add New Program” tab from the top."
                        secondary="ऊपर से “Add New Program” टैब खोलें।"
                        align="start"
                        className="items-start text-left font-semibold text-foreground"
                        secondaryClassName="text-base text-muted-foreground"
                      />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Start with the program name so it is easy to recognise later. नाम लिखें ताकि बाद में तुरंत पहचान सकें।
                      </p>
                    </li>
                    <li className="rounded-xl border border-border/60 bg-muted/50 p-4">
                      <BilingualText
                        primary="Tap the LED file box and choose the .led file from your phone."
                        secondary="LED फाइल बॉक्स पर टैप करें और मोबाइल से .led फाइल चुनें।"
                        align="start"
                        className="items-start text-left font-semibold text-foreground"
                        secondaryClassName="text-base text-muted-foreground"
                      />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Optional: add a short note or photo to remember where you will use it. चाहें तो छोटा नोट या फोटो जोड़ें ताकि याद रहे कहाँ चलाना है।
                      </p>
                    </li>
                    <li className="rounded-xl border border-border/60 bg-muted/50 p-4">
                      <BilingualText
                        primary="Press “Save Program”."
                        secondary="“Save Program” दबाएँ।"
                        align="start"
                        className="items-start text-left font-semibold text-foreground"
                        secondaryClassName="text-base text-muted-foreground"
                      />
                      <p className="mt-2 text-sm text-muted-foreground">
                        The file stays safely in the app. फाइल सुरक्षित रूप से ऐप में सेव हो जाती है।
                      </p>
                    </li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">
                    <BilingualText
                      primary="Copy to SD Card"
                      secondary="SD कार्ड में कॉपी करें"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-base text-muted-foreground"
                    />
                  </h3>
                  <ol className="space-y-3 text-base text-muted-foreground">
                    <li className="rounded-xl border border-border/60 bg-muted/50 p-4">
                      <BilingualText
                        primary="From the catalog, tap the program you saved."
                        secondary="कैटलॉग में सेव किया हुआ प्रोग्राम चुनें।"
                        align="start"
                        className="items-start text-left font-semibold text-foreground"
                        secondaryClassName="text-base text-muted-foreground"
                      />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Use the copy button that shows an SD card icon. SD कार्ड वाले बटन पर टैप करें।
                      </p>
                    </li>
                    <li className="rounded-xl border border-border/60 bg-muted/50 p-4">
                      <BilingualText
                        primary="Allow the app to open your SD card when asked."
                        secondary="पूछने पर ऐप को SD कार्ड खोलने की अनुमति दें।"
                        align="start"
                        className="items-start text-left font-semibold text-foreground"
                        secondaryClassName="text-base text-muted-foreground"
                      />
                      <p className="mt-2 text-sm text-muted-foreground">
                        The file will be copied automatically as <code className="rounded bg-muted px-1 py-0.5 text-foreground">00_program.led</code>.
                        फाइल अपने आप <code className="rounded bg-muted px-1 py-0.5 text-foreground">00_program.led</code> नाम से कॉपी हो जाएगी।
                      </p>
                    </li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">
                    <BilingualText
                      primary="Confirm Everything Worked"
                      secondary="जाँच लें कि सब सही हुआ"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-base text-muted-foreground"
                    />
                  </h3>
                  <ol className="space-y-3 text-base text-muted-foreground">
                    <li className="rounded-xl border border-border/60 bg-muted/50 p-4">
                      <BilingualText
                        primary="Wait for the green success message."
                        secondary="हरी सफलता संदेश आने तक इंतज़ार करें।"
                        align="start"
                        className="items-start text-left font-semibold text-foreground"
                        secondaryClassName="text-base text-muted-foreground"
                      />
                      <p className="mt-2 text-sm text-muted-foreground">
                        If you see an error, try again or check the SD card is unlocked. गलती आने पर दोबारा कोशिश करें या देखें SD कार्ड लॉक तो नहीं।
                      </p>
                    </li>
                    <li className="rounded-xl border border-border/60 bg-muted/50 p-4">
                      <BilingualText
                        primary="Open the SD card on your phone or computer and confirm the new file is there."
                        secondary="SD कार्ड मोबाइल या कंप्यूटर में खोलकर नई फाइल दिख रही है या नहीं देखें।"
                        align="start"
                        className="items-start text-left font-semibold text-foreground"
                        secondaryClassName="text-base text-muted-foreground"
                      />
                      <p className="mt-2 text-sm text-muted-foreground">
                        The name should be <code className="rounded bg-muted px-1 py-0.5 text-foreground">00_program.led</code>. नाम <code className="rounded bg-muted px-1 py-0.5 text-foreground">00_program.led</code> होना चाहिए।
                      </p>
                    </li>
                    <li className="rounded-xl border border-border/60 bg-muted/50 p-4">
                      <BilingualText
                        primary="Insert the SD card into the controller and play it once."
                        secondary="SD कार्ड कंट्रोलर में लगाकर एक बार चला कर देखें।"
                        align="start"
                        className="items-start text-left font-semibold text-foreground"
                        secondaryClassName="text-base text-muted-foreground"
                      />
                      <p className="mt-2 text-sm text-muted-foreground">
                        If the lights follow the new program, everything is perfect! लाइट्स नए प्रोग्राम के हिसाब से चलें तो सब ठीक है।
                      </p>
                    </li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </main>
      <footer className="border-t border-border bg-muted/40">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:text-sm">
          <span className="font-medium text-foreground">Bansal Lights · LED Catalog</span>
          <BilingualText
            primary={`Version ${APP_VERSION}`}
            secondary={`संस्करण ${APP_VERSION}`}
            align="start"
            className="items-start text-left"
            secondaryClassName="text-[11px] text-muted-foreground/80 sm:text-xs"
          />
        </div>
      </footer>
    </div>
  );
}

export default App;
