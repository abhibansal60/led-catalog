import { ChangeEvent, useCallback } from "react";
import {
  CatalogExportMetadata,
  DEFAULT_CONTROLLER,
  Program,
  buildStoredFileNameFromSource,
  generateUniqueProgramId,
  normalizeExportedProgram,
  sortPrograms,
} from "@/lib/catalog";
import { inspectLedFile } from "@/lib/ledFile";
import { saveProgram as saveStoredProgram } from "@/lib/storage";
import { writeFileToHandle } from "@/lib/writeFileToHandle";
import type { useAppState } from "./useAppState";
import type { useFileSystem } from "./useFileSystem";

type Deps = ReturnType<typeof useAppState> &
  ReturnType<typeof useFileSystem>;

export function useImportFlow(s: Deps) {
  const {
    setMetadataImportPrograms,
    setMetadataImportSelections,
    setMetadataImportErrors,
    setMetadataImportDetails,
    setIsMetadataReviewOpen,
    setIsImportDialogOpen,
    setIsImporting,
    ensureDirectoryAccess,
    setFeedback,
    programs,
    ensureStorageCapacity,
    setPrograms,
    metadataImportPrograms,
    setIsProcessingMetadataImport,
    metadataImportSelections,
    metadataImportDetails,
  } = s;

  const resetMetadataImportState = useCallback(() => {
    setMetadataImportPrograms([]);
    setMetadataImportSelections({});
    setMetadataImportErrors({});
    setMetadataImportDetails(null);
    setIsMetadataReviewOpen(false);
  }, []);

  const handleImportCatalog = useCallback(() => {
    resetMetadataImportState();
    setIsImportDialogOpen(true);
  }, [resetMetadataImportState]);

  const handleStartFullImport = useCallback(async () => {
    setIsImportDialogOpen(false);
    setIsImporting(true);
    try {
      const targetDirectory = await ensureDirectoryAccess();
      if (!targetDirectory) {
        return;
      }

      let importDirectory: FileSystemDirectoryHandle;
      try {
        importDirectory = await window.showDirectoryPicker({ mode: "read" });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          console.log("⚠️ Full import cancelled before selecting folder");
          return;
        }
        throw error;
      }

      let catalogHandle: FileSystemFileHandle;
      try {
        catalogHandle = await importDirectory.getFileHandle("catalog.json", { create: false });
      } catch (error) {
        console.warn("⚠️ catalog.json not found in import folder", error);
        setFeedback({
          type: "error",
          message: "catalog.json not found in that folder. catalog.json फ़ाइल नहीं मिली.",
        });
        return;
      }

      let parsed: CatalogExportMetadata;
      try {
        const catalogFile = await catalogHandle.getFile();
        const catalogText = await catalogFile.text();
        parsed = JSON.parse(catalogText) as CatalogExportMetadata;
      } catch (error) {
        console.error("❌ Could not read catalog.json", error);
        setFeedback({
          type: "error",
          message: "Invalid catalog.json file. catalog.json पढ़ा नहीं जा सका.",
        });
        return;
      }

      const exportedPrograms = Array.isArray(parsed.programs) ? parsed.programs : [];
      if (exportedPrograms.length === 0) {
        setFeedback({
          type: "error",
          message: "No programs found in backup. बैकअप में कोई प्रोग्राम नहीं मिला.",
        });
        return;
      }

      const normalizedRecords = exportedPrograms.map((record, index) => normalizeExportedProgram(record, index));
      const usedIds = new Set(programs.map((program) => program.id));
      const createdPrograms: Program[] = [];
      let missingCount = 0;

      for (const [index, record] of normalizedRecords.entries()) {
        const finalId = generateUniqueProgramId(record.id, usedIds);
        let originalLedName = record.originalLedName;
        let storedFileName = buildStoredFileNameFromSource(finalId, originalLedName, index);
        let fileSize = record.fileSizeBytes ?? null;
        let isFileMissing = record.isFileMissing ?? false;

        if (!isFileMissing && record.exportedLedFileName) {
          try {
            const sourceFileHandle = await importDirectory.getFileHandle(record.exportedLedFileName, { create: false });
            const sourceFile = await sourceFileHandle.getFile();
            const hasSpace = await ensureStorageCapacity(sourceFile.size);
            if (hasSpace) {
              originalLedName = sourceFile.name;
              storedFileName = buildStoredFileNameFromSource(finalId, sourceFile.name, index);
              const targetFileHandle = await targetDirectory.getFileHandle(storedFileName, { create: true });
              try {
                await writeFileToHandle(targetFileHandle, sourceFile);
                fileSize = sourceFile.size;
              } catch (writeError) {
                console.warn("⚠️ Failed to copy LED file during import", writeError);
                try {
                  await targetDirectory.removeEntry(storedFileName);
                } catch (cleanupError) {
                  console.warn("⚠️ Could not clean up partial import file", cleanupError);
                }
                isFileMissing = true;
              }
            } else {
              isFileMissing = true;
            }
          } catch (error) {
            console.warn("⚠️ Could not find LED file in backup", { name: record.name, error });
            isFileMissing = true;
          }
        } else if (!isFileMissing) {
          isFileMissing = true;
        }

        if (isFileMissing) {
          missingCount += 1;
        }

        const programToStore: Program = {
          id: finalId,
          name: record.name,
          description: record.description,
          originalLedName,
          storedFileName,
          photoDataUrl: record.photoDataUrl,
          dateAdded: record.dateAdded,
          fileSizeBytes: fileSize,
          controller: record.controller ?? DEFAULT_CONTROLLER,
          isFileMissing,
        };

        await saveStoredProgram(programToStore);
        createdPrograms.push(programToStore);
      }

      if (createdPrograms.length > 0) {
        setPrograms((prev) => sortPrograms([...prev, ...createdPrograms]));
      }

      const mappedCount = createdPrograms.length - missingCount;
      let message = `Imported ${createdPrograms.length} programs from backup.`;
      if (mappedCount > 0 && missingCount > 0) {
        message = `Imported ${createdPrograms.length} programs (${mappedCount} ready, ${missingCount} need LED files).`;
      } else if (missingCount > 0) {
        message = `Imported ${createdPrograms.length} programs. Map LED files to finish setup.`;
      }

      setFeedback({
        type: missingCount > 0 ? "error" : "success",
        message,
      });

      console.log("📥 Full backup imported", {
        total: createdPrograms.length,
        mapped: mappedCount,
        missing: missingCount,
        exportedAt: parsed.exportedAt,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.log("⚠️ Full import cancelled by user");
        return;
      }
      console.error("❌ Full import failed", error);
      setFeedback({
        type: "error",
        message: "Import failed. इम्पोर्ट नहीं हो पाया.",
      });
    } finally {
      setIsImporting(false);
    }
  }, [ensureDirectoryAccess, ensureStorageCapacity, programs]);

  const handleStartMetadataImport = useCallback(async () => {
    setIsImportDialogOpen(false);
    setIsImporting(true);
    try {
      let fileHandle: FileSystemFileHandle;
      try {
        const [picked] = await window.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: "Catalog JSON",
              accept: { "application/json": [".json"] },
            },
          ],
        });
        fileHandle = picked;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          console.log("⚠️ Metadata import cancelled before file selection");
          return;
        }
        throw error;
      }

      let metadataFile: File;
      try {
        metadataFile = await fileHandle.getFile();
      } catch (error) {
        console.error("❌ Could not read selected metadata file", error);
        setFeedback({
          type: "error",
          message: "Could not read file. फाइल नहीं पढ़ी जा सकी.",
        });
        return;
      }

      let parsed: CatalogExportMetadata;
      try {
        const contents = await metadataFile.text();
        parsed = JSON.parse(contents) as CatalogExportMetadata;
      } catch (error) {
        console.error("❌ Could not parse metadata file", error);
        setFeedback({
          type: "error",
          message: "Invalid catalog JSON. JSON सही नहीं है.",
        });
        return;
      }

      const exportedPrograms = Array.isArray(parsed.programs) ? parsed.programs : [];
      if (exportedPrograms.length === 0) {
        setFeedback({
          type: "error",
          message: "No programs found in file. फाइल में कोई प्रोग्राम नहीं मिला.",
        });
        return;
      }

      const normalizedRecords = exportedPrograms.map((record, index) => normalizeExportedProgram(record, index));
      setMetadataImportPrograms(normalizedRecords);
      setMetadataImportErrors({});
      const initialSelections: Record<string, File | null> = {};
      for (const program of normalizedRecords) {
        initialSelections[program.tempId] = null;
      }
      setMetadataImportSelections(initialSelections);
      setMetadataImportDetails({
        fileName: metadataFile.name,
        exportedAt: parsed.exportedAt,
        programCount: normalizedRecords.length,
      });
      setIsMetadataReviewOpen(true);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.log("⚠️ Metadata import cancelled");
        return;
      }
      console.error("❌ Metadata import failed", error);
      setFeedback({
        type: "error",
        message: "Import failed. इम्पोर्ट नहीं हो पाया.",
      });
    } finally {
      setIsImporting(false);
    }
  }, []);

  const handleMetadataFileSelect = useCallback(
    async (tempId: string, event: ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const file = input.files?.[0] ?? null;
      if (file && !file.name.toLowerCase().endsWith(".led")) {
        setMetadataImportErrors((prev) => ({
          ...prev,
          [tempId]: "Only .led files are supported. केवल .led फाइल चुनें.",
        }));
        setMetadataImportSelections((prev) => ({
          ...prev,
          [tempId]: null,
        }));
        input.value = "";
        return;
      }

      if (file) {
        const header = await inspectLedFile(file);
        if (!header.ok) {
          setMetadataImportErrors((prev) => ({
            ...prev,
            [tempId]: "This .led file looks corrupted or invalid. यह .led फाइल खराब या अमान्य लग रही है.",
          }));
          setMetadataImportSelections((prev) => ({
            ...prev,
            [tempId]: null,
          }));
          input.value = "";
          console.warn("❌ LED file failed integrity check", file.name, header.warnings);
          return;
        }
        if (header.warnings.length > 0) {
          console.warn("⚠️ LED file integrity warnings", file.name, header.warnings);
        }
      }

      setMetadataImportErrors((prev) => {
        if (!(tempId in prev)) {
          return prev;
        }
        const { [tempId]: _removed, ...rest } = prev;
        return rest;
      });
      setMetadataImportSelections((prev) => ({
        ...prev,
        [tempId]: file,
      }));
    },
    []
  );

  const handleClearMetadataSelection = useCallback((tempId: string) => {
    setMetadataImportSelections((prev) => ({
      ...prev,
      [tempId]: null,
    }));
    setMetadataImportErrors((prev) => {
      if (!(tempId in prev)) {
        return prev;
      }
      const { [tempId]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleCancelMetadataImport = useCallback(() => {
    resetMetadataImportState();
  }, [resetMetadataImportState]);

  const handleConfirmMetadataImport = useCallback(async () => {
    if (metadataImportPrograms.length === 0) {
      setFeedback({
        type: "error",
        message: "Load a metadata file first. पहले JSON फाइल चुनें.",
      });
      return;
    }

    setIsProcessingMetadataImport(true);
    setIsImporting(true);

    try {
      const targetDirectory = await ensureDirectoryAccess();
      if (!targetDirectory) {
        return;
      }

      const usedIds = new Set(programs.map((program) => program.id));
      const createdPrograms: Program[] = [];
      let missingCount = 0;

      for (const [index, record] of metadataImportPrograms.entries()) {
        const finalId = generateUniqueProgramId(record.id, usedIds);
        const selectedFile = metadataImportSelections[record.tempId] ?? null;
        let originalLedName = selectedFile?.name ?? record.originalLedName;
        let storedFileName = buildStoredFileNameFromSource(finalId, originalLedName, index);
        let fileSize = record.fileSizeBytes ?? null;
        let isFileMissing = record.isFileMissing ?? false;

        if (selectedFile) {
          const hasSpace = await ensureStorageCapacity(selectedFile.size);
          if (hasSpace) {
            storedFileName = buildStoredFileNameFromSource(finalId, selectedFile.name, index);
            try {
              const fileHandle = await targetDirectory.getFileHandle(storedFileName, { create: true });
              await writeFileToHandle(fileHandle, selectedFile);
              fileSize = selectedFile.size;
              isFileMissing = false;
            } catch (error) {
              console.error("❌ Failed to save selected LED file", error);
              try {
                await targetDirectory.removeEntry(storedFileName);
              } catch (cleanupError) {
                console.warn("⚠️ Could not clean up failed LED file", cleanupError);
              }
              isFileMissing = true;
            }
          } else {
            isFileMissing = true;
          }
        } else {
          isFileMissing = true;
        }

        if (isFileMissing) {
          missingCount += 1;
        }

        const programToStore: Program = {
          id: finalId,
          name: record.name,
          description: record.description,
          originalLedName,
          storedFileName,
          photoDataUrl: record.photoDataUrl,
          dateAdded: record.dateAdded,
          fileSizeBytes: fileSize,
          controller: record.controller ?? DEFAULT_CONTROLLER,
          isFileMissing,
        };

        await saveStoredProgram(programToStore);
        createdPrograms.push(programToStore);
      }

      if (createdPrograms.length > 0) {
        setPrograms((prev) => sortPrograms([...prev, ...createdPrograms]));
      }

      const mappedCount = createdPrograms.length - missingCount;
      let message = `Imported ${createdPrograms.length} programs from metadata.`;
      if (mappedCount > 0 && missingCount > 0) {
        message = `Imported ${createdPrograms.length} programs (${mappedCount} mapped, ${missingCount} pending).`;
      } else if (missingCount > 0) {
        message = `Imported ${createdPrograms.length} programs. Link LED files from Edit later.`;
      }

      setFeedback({
        type: missingCount > 0 ? "error" : "success",
        message,
      });

      console.log("🧾 Metadata import applied", {
        total: createdPrograms.length,
        mapped: mappedCount,
        missing: missingCount,
        sourceFile: metadataImportDetails?.fileName,
      });

      resetMetadataImportState();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.log("⚠️ Metadata import cancelled during confirmation");
        return;
      }
      console.error("❌ Applying metadata import failed", error);
      setFeedback({
        type: "error",
        message: "Import failed. इम्पोर्ट नहीं हो पाया.",
      });
    } finally {
      setIsProcessingMetadataImport(false);
      setIsImporting(false);
    }
  }, [
    ensureDirectoryAccess,
    ensureStorageCapacity,
    metadataImportDetails,
    metadataImportPrograms,
    metadataImportSelections,
    programs,
    resetMetadataImportState,
  ]);

  return {
    resetMetadataImportState,
    handleImportCatalog,
    handleStartFullImport,
    handleStartMetadataImport,
    handleMetadataFileSelect,
    handleClearMetadataSelection,
    handleCancelMetadataImport,
    handleConfirmMetadataImport,
  };
}
