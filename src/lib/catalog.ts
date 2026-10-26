import { type ControllerType, type StoredProgram } from "@/lib/storage";

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const REFRESH_PASSWORD = "0000";
export const COPIED_LED_FILENAME = "00_program.led";
export const DEFAULT_CONTROLLER: ControllerType = "t1000";

export const CONTROLLER_OPTIONS: Array<{ value: ControllerType; label: string }> = [
  { value: "t1000", label: "T1000" },
  { value: "t8000", label: "T8000" },
];

export type Program = StoredProgram;

export type FeedbackMessage = {
  type: "success" | "error";
  message: string;
};

export const formatControllerLabel = (controller: ControllerType): string => controller.toUpperCase();

export const getProgramController = (program: Pick<Program, "controller">): ControllerType =>
  program.controller ?? DEFAULT_CONTROLLER;

export const getProgramMetadataFilename = (program: Program): string => {
  const trimmedName = program.name.trim();
  if (trimmedName) {
    const sanitizedName = sanitizeFileName(trimmedName);
    if (sanitizedName) {
      return `${sanitizedName}.txt`;
    }
  }

  const ledBase = sanitizeFileName(program.originalLedName.replace(/\.[^.]+$/, ""));
  if (ledBase) {
    return `${ledBase}.txt`;
  }

  const fallback = program.id ? sanitizeFileName(program.id) : "program";
  return `${fallback || "program"}.txt`;
};

export type ProgramFormState = {
  programName: string;
  ledFile: File | null;
  description: string;
  photoFile: File | null;
  controller: ControllerType;
};

export const getEmptyForm = (): ProgramFormState => ({
  programName: "",
  ledFile: null,
  description: "",
  photoFile: null,
  controller: DEFAULT_CONTROLLER,
});

export const readFileAsDataUrl = (file: File): Promise<string> =>
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

export const sanitizeFileName = (name: string): string =>
  name.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "-");

export const sortPrograms = (items: Program[]): Program[] =>
  [...items].sort(
    (a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
  );

export const generateUniqueProgramId = (preferredId: string | null | undefined, usedIds: Set<string>): string => {
  const trimmedPreferred = preferredId?.trim();
  if (trimmedPreferred && !usedIds.has(trimmedPreferred)) {
    usedIds.add(trimmedPreferred);
    return trimmedPreferred;
  }

  let generatedId = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  while (usedIds.has(generatedId)) {
    generatedId = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }
  usedIds.add(generatedId);
  return generatedId;
};

export const ensureValidIsoDate = (value?: string | null): string => {
  if (value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return new Date().toISOString();
};

export const buildStoredFileNameFromSource = (id: string, sourceName: string | null | undefined, fallbackIndex: number): string => {
  const baseName = sourceName && sourceName.trim() ? sourceName.trim() : `program-${fallbackIndex + 1}.led`;
  return `${id}-${sanitizeFileName(baseName)}`;
};

export const normalizeExportedProgram = (
  record: ExportedProgramMetadata,
  index: number
): MetadataImportProgram => {
  const preferredId = typeof record.id === "string" && record.id.trim() ? record.id.trim() : null;
  const safeId = preferredId ?? `import-${Date.now()}-${Math.random().toString(16).slice(2, 8)}-${index}`;
  const fallbackName = record.name && record.name.trim() ? record.name.trim() : `Program ${index + 1}`;
  const sanitizedFallback = sanitizeFileName(fallbackName) || `program-${index + 1}`;
  const fallbackLedName = sanitizedFallback.toLowerCase().endsWith(".led")
    ? sanitizedFallback
    : `${sanitizedFallback}.led`;
  const originalLedName =
    record.originalLedName && record.originalLedName.trim()
      ? record.originalLedName.trim()
      : record.exportedLedFileName && record.exportedLedFileName.trim()
      ? record.exportedLedFileName.trim()
      : fallbackLedName;
  const storedFileName =
    record.storedFileName && record.storedFileName.trim()
      ? record.storedFileName.trim()
      : buildStoredFileNameFromSource(safeId, originalLedName, index);

  return {
    tempId: `${safeId}-${index}-${Math.random().toString(16).slice(2, 10)}`,
    id: safeId,
    name: fallbackName,
    description: record.description ?? "",
    dateAdded: ensureValidIsoDate(record.dateAdded),
    originalLedName,
    storedFileName,
    exportedLedFileName: record.exportedLedFileName ?? null,
    fileSizeBytes: record.fileSizeBytes ?? null,
    photoDataUrl: record.photoDataUrl ?? null,
    controller: record.controller ?? DEFAULT_CONTROLLER,
    notes: record.notes,
    isFileMissing: record.isFileMissing ?? false,
  };
};

export type CopyStatus = {
  status: "copying" | "verifying" | "success" | "error";
  progress: number;
  message?: string;
};

export const formatFileSize = (bytes?: number | null): string => {
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

export type ExportedProgramMetadata = {
  id?: string;
  name?: string;
  description?: string;
  dateAdded?: string;
  originalLedName?: string;
  storedFileName?: string;
  exportedLedFileName?: string | null;
  fileSizeBytes?: number | null;
  photoDataUrl?: string | null;
  controller?: ControllerType;
  notes?: string;
  isFileMissing?: boolean;
};

export type CatalogExportMetadata = {
  exportedAt?: string;
  programCount?: number;
  programs?: ExportedProgramMetadata[];
  instructions?: string;
};

export type ExportedProgramRecord = {
  id: string;
  name: string;
  description: string;
  dateAdded: string;
  originalLedName: string;
  storedFileName: string;
  exportedLedFileName: string | null;
  fileSizeBytes: number | null | undefined;
  photoDataUrl: string | null;
  controller: ControllerType;
  notes?: string;
  isFileMissing?: boolean;
};

export type MetadataImportProgram = ExportedProgramRecord & {
  tempId: string;
};
