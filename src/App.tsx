import React, { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import {
  Download,
  Trash2,
  PlusCircle,
  Image as ImageIcon,
  FilePlus2,
  FolderCheck,
  FolderX,
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

function App(): JSX.Element {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [formData, setFormData] = useState<ProgramFormState>(getEmptyForm);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"view" | "add">("view");
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [directoryPermission, setDirectoryPermission] = useState<PermissionState | null>(null);
  const [isFileSystemSupported, setIsFileSystemSupported] = useState(false);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(true);
  const [hasPersistentStorage, setHasPersistentStorage] = useState<boolean | null>(null);

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
    if (!feedback) {
      return;
    }
    const timerId = window.setTimeout(() => setFeedback(null), 5000);
    return () => window.clearTimeout(timerId);
  }, [feedback]);

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
    console.log("📸 Photo ready", file.name);
  };

  const handleCancel = () => {
    setFormData(getEmptyForm());
    document.querySelectorAll<HTMLInputElement>("input[type='file']").forEach((input) => {
      input.value = "";
    });
    console.log("↩️ Form cleared by user");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData.programName.trim()) {
      setFeedback({
        type: "error",
        message: "Program name is required. प्रोग्राम नाम लिखें.",
      });
      return;
    }
    if (!formData.ledFile) {
      setFeedback({
        type: "error",
        message: "Please choose a .led file. कृपया .led फाइल चुनें.",
      });
      return;
    }

    setIsSaving(true);
    let storedFileName = "";
    let activeDirectory: FileSystemDirectoryHandle | null = null;
    try {
      const hasSpace = await ensureStorageCapacity(
        formData.ledFile.size + (formData.photoFile?.size ?? 0)
      );
      if (!hasSpace) {
        return;
      }

      activeDirectory = await ensureDirectoryAccess();
      if (!activeDirectory) {
        return;
      }

      const id = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
      storedFileName = `${id}-${sanitizeFileName(formData.ledFile.name)}`;
      const fileHandle = await activeDirectory.getFileHandle(storedFileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(formData.ledFile);
      await writable.close();

      const photoDataUrl = formData.photoFile
        ? await readFileAsDataUrl(formData.photoFile)
        : null;

      const newProgram: Program = {
        id,
        name: formData.programName.trim(),
        description: formData.description.trim(),
        originalLedName: formData.ledFile.name,
        storedFileName,
        photoDataUrl,
        dateAdded: new Date().toISOString(),
      };

      await saveStoredProgram(newProgram);
      setPrograms((prev) => sortPrograms([newProgram, ...prev]));
      handleCancel();
      setFeedback({
        type: "success",
        message: "Program saved! प्रोग्राम सेव हो गया.",
      });
      setActiveTab("view");
      console.log("💾 Program saved", { name: newProgram.name, id: newProgram.id });
    } catch (error) {
      console.error("❌ Saving program failed", error);
      if (storedFileName && activeDirectory) {
        try {
          await activeDirectory.removeEntry(storedFileName);
        } catch (cleanupError) {
          console.warn("⚠️ Could not clean up partial file", cleanupError);
        }
      }
      setFeedback({
        type: "error",
        message: "Could not save program. प्रोग्राम सेव नहीं हुआ.",
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
      const downloadName = sanitizeFileName(
        program.originalLedName || "program.led"
      );
      const url = window.URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadName.endsWith(".led")
        ? downloadName
        : `${downloadName}.led`;
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

  const handleClearAll = async () => {
    const confirmed = window.confirm("Clear all saved programs?\nसब प्रोग्राम हटाने हैं?");
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
            Reset | रीसेट
          </button>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Bansal Lights - LED Catalog</h1>
          <p className="text-lg text-primary-foreground/90">अपने LED प्रोग्राम्स यहाँ सेव करें</p>
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
                    : "Choose a folder to store LED files | LED फाइल सेव करने का फोल्डर चुनें"}
                </p>
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
              {directoryPermission === "granted" ? "Change Folder | फोल्डर बदलें" : "Connect Folder | फोल्डर जोड़ें"}
            </Button>
          </div>
        ) : (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
            आपका ब्राउज़र यह फीचर नहीं चला सकता। Chrome या Edge (Desktop/Android) का इस्तेमाल करें।
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
            📂 View Catalog | कैटलॉग देखें
          </Button>
          <Button
            type="button"
            variant={!isViewTab ? "primary" : "ghost"}
            className="w-full sm:flex-1"
            onClick={() => setActiveTab("add")}
            aria-pressed={!isViewTab}
          >
            ➕ Add New Program | नया जोड़ें
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
          <section>
            <h2 className="mb-4 text-2xl font-semibold">Saved Programs | सेव किए गए प्रोग्राम</h2>
            {isLoadingPrograms ? (
              <Card className="border border-dashed border-border bg-card text-muted-foreground">
                <CardContent className="space-y-4 py-10 text-center text-base">
                  <p>Loading catalog… कैटलॉग लोड हो रहा है…</p>
                </CardContent>
              </Card>
            ) : hasPrograms ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {programs.map((program) => (
                  <Card key={program.id} className="flex flex-col overflow-hidden border border-border bg-card">
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
                      <div>
                        <h3 className="text-xl font-semibold text-foreground">{program.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Added: {new Date(program.dateAdded).toLocaleString()}
                        </p>
                      </div>
                      {program.description && (
                        <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-base text-foreground leading-relaxed">
                          {program.description}
                        </p>
                      )}
                      <div className="mt-auto flex flex-col gap-3">
                        <Button type="button" variant="success" onClick={() => handleDownload(program)}>
                          <Download className="h-6 w-6" aria-hidden="true" />
                          📥 Download | डाउनलोड करें
                        </Button>
                        <Button type="button" variant="destructive" onClick={() => handleDelete(program.id)}>
                          <Trash2 className="h-6 w-6" aria-hidden="true" />
                          🗑️ Delete | हटाएं
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border border-dashed border-border bg-card text-muted-foreground">
                <CardContent className="space-y-4 py-10 text-center text-base">
                  <p className="text-xl text-foreground">💡 अभी कोई प्रोग्राम सेव नहीं है।</p>
                  <p>
                    नीचे वाले बटन से नया प्रोग्राम जोड़ें। फाइल डाउनलोड करके SD कार्ड में कॉपी करें।
                  </p>
                  <Button type="button" onClick={() => setActiveTab("add")}>
                    ➕ Add Program | नया जोड़ें
                  </Button>
                </CardContent>
              </Card>
            )}
          </section>
        ) : (
          <Card className="border border-border bg-card shadow-md">
            <CardHeader className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <PlusCircle className="h-7 w-7 text-primary" aria-hidden="true" />
                <CardTitle>Add New Program | नया प्रोग्राम जोड़ें</CardTitle>
              </div>
              <CardDescription className="text-base text-muted-foreground">
                LED फाइल चुनें और सेव करें। सब कुछ आपके फोन में सुरक्षित रहेगा।
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="programName">Program Name | प्रोग्राम नाम *</Label>
                  <Input
                    id="programName"
                    name="programName"
                    value={formData.programName}
                    onChange={handleTextChange}
                    maxLength={50}
                    required
                    placeholder="e.g., Shaadi Entry | शादी एंट्री"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>LED File (.led) | LED फाइल (.led) *</Label>
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 px-4 py-6 text-center text-muted-foreground">
                    <FilePlus2 className="mb-2 h-10 w-10 text-primary" aria-hidden="true" />
                    <span className="mb-1 text-base">Tap to choose LED file | LED फाइल चुनें</span>
                    <span className="text-xs text-muted-foreground/80">
                      Only .led files are accepted | सिर्फ .led फाइल
                    </span>
                    <input type="file" accept=".led" onChange={handleLedFileChange} className="sr-only" />
                  </label>
                  {formData.ledFile && (
                    <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
                      ✅ File ready: {formData.ledFile.name}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="description">Description | विवरण (optional)</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleTextChange}
                    maxLength={200}
                    rows={3}
                    placeholder="जैसे: लाल-सफेद चमकती लाइट | e.g., Red-white flashing"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Photo | फोटो (optional)</Label>
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 px-4 py-6 text-center text-muted-foreground">
                    <ImageIcon className="mb-2 h-10 w-10 text-primary" aria-hidden="true" />
                    <span className="mb-1 text-base">Add photo | फोटो जोड़ें</span>
                    <span className="text-xs text-muted-foreground/80">JPG/PNG, max 2MB | JPG/PNG, अधिकतम 2MB</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg"
                      onChange={handlePhotoChange}
                      className="sr-only"
                    />
                  </label>
                  {formData.photoFile && (
                    <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
                      📷 Photo ready: {formData.photoFile.name}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="submit" disabled={isSaving}>
                    💾 Save | सेव करें
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleCancel}>
                    ✖️ Cancel | रद्द करें
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
