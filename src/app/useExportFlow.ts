import {
  CatalogExportMetadata,
  ExportedProgramRecord,
  Program,
  REFRESH_PASSWORD,
  getProgramController,
  sanitizeFileName,
} from "@/lib/catalog";
import { clearPrograms as clearStoredPrograms } from "@/lib/storage";
import { writeFileToHandle } from "@/lib/writeFileToHandle";
import type { useAppState } from "./useAppState";
import type { useFileSystem } from "./useFileSystem";
import type { useImportFlow } from "./useImportFlow";
import type { useProgramForm } from "./useProgramForm";
import type { useProgramActions } from "./useProgramActions";

type Deps = ReturnType<typeof useAppState> &
  ReturnType<typeof useFileSystem> &
  ReturnType<typeof useImportFlow> &
  ReturnType<typeof useProgramForm> &
  ReturnType<typeof useProgramActions>;

export function useExportFlow(s: Deps) {
  const {
    programs,
    setFeedback,
    setExportInProgress,
    ensureDirectoryAccess,
    directoryHandle,
    directoryPermission,
    setPrograms,
  } = s;

  const handleExportCatalog = async (mode: "full" | "json") => {
    if (programs.length === 0) {
      setFeedback({
        type: "error",
        message: "No programs to export. एक्सपोर्ट करने के लिए कोई प्रोग्राम नहीं है.",
      });
      return;
    }

    if (mode === "full" && !("showDirectoryPicker" in window)) {
      setFeedback({
        type: "error",
        message: "Browser does not support export. ब्राउज़र एक्सपोर्ट नहीं कर सकता.",
      });
      return;
    }

    setExportInProgress(mode);

    try {
      const timestamp = new Date();
      const exportedAt = timestamp.toISOString();

      if (mode === "full") {
        const sourceDirectory = await ensureDirectoryAccess();
        if (!sourceDirectory) {
          return;
        }

        const exportRoot = await window.showDirectoryPicker({ mode: "readwrite" });
        const folderName = `led-catalog-export-${exportedAt.replace(/[:.]/g, "-")}`;
        const exportDirectory = await exportRoot.getDirectoryHandle(folderName, { create: true });

        const exportedPrograms: ExportedProgramRecord[] = [];
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
          let notes: string | undefined = program.isFileMissing ? "LED file not linked locally" : undefined;

          try {
            const sourceFileHandle = await sourceDirectory.getFileHandle(program.storedFileName, { create: false });
            const sourceFile = await sourceFileHandle.getFile();
            ledSize = sourceFile.size;
            const exportFileName = getExportFileName(program, index);
            const targetFileHandle = await exportDirectory.getFileHandle(exportFileName, { create: true });
            await writeFileToHandle(targetFileHandle, sourceFile);
            exportedLedFileName = exportFileName;
          } catch (error) {
            console.warn("⚠️ Failed to export LED file", { id: program.id, error });
            notes = notes
              ? `${notes}; LED file missing or permission denied`
              : "LED file missing or permission denied";
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
            controller: getProgramController(program),
            isFileMissing: program.isFileMissing ?? false,
            ...(notes ? { notes } : {}),
          });
        }

        const metadataHandle = await exportDirectory.getFileHandle("catalog.json", { create: true });
        const metadataWritable = await metadataHandle.createWritable();
        const metadata: CatalogExportMetadata & { exportedAt: string; programCount: number } = {
          exportedAt,
          programCount: exportedPrograms.length,
          instructions:
            "Copy this entire folder to the new device and open catalog.json to view program details.",
          programs: exportedPrograms,
        };
        await metadataWritable.write(`${JSON.stringify(metadata, null, 2)}\n`);
        await metadataWritable.close();

        setFeedback({
          type: "success",
          message: `Export complete in local folder "${folderName}". स्थानीय फ़ोल्डर में एक्सपोर्ट पूरा हुआ।`,
        });

        console.log("📦 Catalog exported", { folderName, programCount: programs.length });
        return;
      }

      const exportedPrograms: ExportedProgramRecord[] = programs.map((program) => ({
        id: program.id,
        name: program.name,
        description: program.description,
        dateAdded: program.dateAdded,
        originalLedName: program.originalLedName,
        storedFileName: program.storedFileName,
        exportedLedFileName: null,
        fileSizeBytes: program.fileSizeBytes ?? null,
        photoDataUrl: program.photoDataUrl,
        controller: getProgramController(program),
        isFileMissing: program.isFileMissing ?? false,
        ...(program.isFileMissing
          ? { notes: "LED file not linked locally" }
          : {}),
      }));

      const metadata: CatalogExportMetadata & { exportedAt: string; programCount: number } = {
        exportedAt,
        programCount: exportedPrograms.length,
        instructions:
          "This quick backup only contains catalog metadata. Export LED files separately if needed.",
        programs: exportedPrograms,
      };

      const metadataText = `${JSON.stringify(metadata, null, 2)}\n`;
      const blob = new Blob([metadataText], { type: "application/json" });
      const suggestedName = `led-catalog-backup-${exportedAt.replace(/[:.]/g, "-")}.json`;
      let savedFileName = suggestedName;

      if ("showSaveFilePicker" in window) {
        try {
          const saveHandle = await window.showSaveFilePicker({
            suggestedName,
            types: [
              {
                description: "Catalog JSON",
                accept: { "application/json": [".json"] },
              },
            ],
          });
          savedFileName = saveHandle.name;
          const writable = await saveHandle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            console.log("⚠️ Catalog export cancelled by user");
            return;
          }
          throw error;
        }
      } else {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = suggestedName;
        anchor.rel = "noopener";
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      setFeedback({
        type: "success",
        message: `Quick JSON backup saved locally as "${savedFileName}". JSON बैकअप स्थानीय फ़ाइल में सेव हुआ।`,
      });

      console.log("🧾 Catalog metadata exported", {
        fileName: savedFileName,
        programCount: programs.length,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.log("⚠️ Catalog export cancelled by user");
        return;
      }
      console.error("❌ Catalog export failed", error);
      setFeedback({
        type: "error",
        message: "Local export failed. स्थानीय एक्सपोर्ट नहीं हो पाया.",
      });
    } finally {
      setExportInProgress(null);
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

  return {
    handleExportCatalog,
    handleClearAll,
  };
}
