import { ChangeEvent, FormEvent } from "react";
import {
  MAX_PHOTO_BYTES,
  Program,
  getEmptyForm,
  readFileAsDataUrl,
  sanitizeFileName,
  sortPrograms,
} from "@/lib/catalog";
import { inspectLedFile } from "@/lib/ledFile";
import { saveProgram as saveStoredProgram, type ControllerType } from "@/lib/storage";
import { writeFileToHandle } from "@/lib/writeFileToHandle";
import type { useAppState } from "./useAppState";
import type { useFileSystem } from "./useFileSystem";
import type { useImportFlow } from "./useImportFlow";

type Deps = ReturnType<typeof useAppState> &
  ReturnType<typeof useFileSystem> &
  ReturnType<typeof useImportFlow>;

export function useProgramForm(s: Deps) {
  const {
    setFormData,
    setFeedback,
    setShouldRemovePhoto,
    editingProgramId,
    setEditingProgramId,
    setActiveTab,
    formData,
    setIsSaving,
    setSaveProgress,
    programs,
    ensureStorageCapacity,
    ensureDirectoryAccess,
    shouldRemovePhoto,
    setPrograms,
  } = s;

  const handleTextChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    if (name === "programName" || name === "description") {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleControllerChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as ControllerType;
    setFormData((prev) => ({
      ...prev,
      controller: value,
    }));
  };

  const handleLedFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const isLedFile = file.name.toLowerCase().endsWith(".led");
    if (!isLedFile) {
      setFormData((prev) => ({ ...prev, ledFile: null }));
      input.value = "";
      setFeedback({
        type: "error",
        message: "Please select a .led file. केवल .led फाइल चुनें.",
      });
      console.warn("❌ Invalid LED file selected", file.name);
      return;
    }

    const header = await inspectLedFile(file);
    if (!header.ok) {
      setFormData((prev) => ({ ...prev, ledFile: null }));
      input.value = "";
      setFeedback({
        type: "error",
        message: "This .led file looks corrupted or invalid. यह .led फाइल खराब या अमान्य लग रही है.",
      });
      console.warn("❌ LED file failed integrity check", file.name, header.warnings);
      return;
    }
    if (header.warnings.length > 0) {
      console.warn("⚠️ LED file integrity warnings", file.name, header.warnings);
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
    setSaveProgress(formData.ledFile ? 0 : null);
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
          createdFileName = updatedStoredFileName;
          createdFileWasReplacement = updatedStoredFileName === programToUpdate.storedFileName;
          await writeFileToHandle(fileHandle, formData.ledFile, (progress) => setSaveProgress(progress));

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
          controller: formData.controller,
          isFileMissing: formData.ledFile ? false : programToUpdate.isFileMissing ?? false,
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
        createdFileName = storedFileName;
        await writeFileToHandle(fileHandle, formData.ledFile!, (progress) => setSaveProgress(progress));

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
          controller: formData.controller,
          isFileMissing: false,
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
      setSaveProgress(null);
      setIsSaving(false);
    }
  };

  return {
    handleTextChange,
    handleControllerChange,
    handleLedFileChange,
    handlePhotoChange,
    handleCancel,
    handleSubmit,
  };
}
