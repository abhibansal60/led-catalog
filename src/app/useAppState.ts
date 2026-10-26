import { useState } from "react";
import {
  CopyStatus,
  FeedbackMessage,
  MetadataImportProgram,
  Program,
  ProgramFormState,
  getEmptyForm,
} from "@/lib/catalog";

export function useAppState() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [formData, setFormData] = useState<ProgramFormState>(getEmptyForm);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<number | null>(null);
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
  const [exportInProgress, setExportInProgress] = useState<"full" | "json" | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isMetadataReviewOpen, setIsMetadataReviewOpen] = useState(false);
  const [metadataImportPrograms, setMetadataImportPrograms] = useState<MetadataImportProgram[]>([]);
  const [metadataImportDetails, setMetadataImportDetails] = useState<
    | {
        fileName: string;
        exportedAt?: string | null;
        programCount: number;
      }
    | null
  >(null);
  const [metadataImportSelections, setMetadataImportSelections] = useState<Record<string, File | null>>({});
  const [metadataImportErrors, setMetadataImportErrors] = useState<Record<string, string>>({});
  const [isProcessingMetadataImport, setIsProcessingMetadataImport] = useState(false);

  const isExporting = exportInProgress !== null;

  const savingPercent = saveProgress === null ? null : Math.min(100, Math.round(saveProgress * 100));
  const savingStatusMessage =
    saveProgress === null
      ? "Saving changes…"
      : savingPercent !== null && savingPercent >= 100
      ? "Finishing up…"
      : `Saving file… ${savingPercent ?? 0}%`;

  return {
    programs,
    setPrograms,
    formData,
    setFormData,
    feedback,
    setFeedback,
    isSaving,
    setIsSaving,
    saveProgress,
    setSaveProgress,
    activeTab,
    setActiveTab,
    editingProgramId,
    setEditingProgramId,
    shouldRemovePhoto,
    setShouldRemovePhoto,
    directoryHandle,
    setDirectoryHandle,
    directoryPermission,
    setDirectoryPermission,
    isFileSystemSupported,
    setIsFileSystemSupported,
    isLoadingPrograms,
    setIsLoadingPrograms,
    hasPersistentStorage,
    setHasPersistentStorage,
    catalogView,
    setCatalogView,
    copyStatuses,
    setCopyStatuses,
    searchTerm,
    setSearchTerm,
    exportInProgress,
    setExportInProgress,
    isExportDialogOpen,
    setIsExportDialogOpen,
    isImporting,
    setIsImporting,
    isImportDialogOpen,
    setIsImportDialogOpen,
    isMetadataReviewOpen,
    setIsMetadataReviewOpen,
    metadataImportPrograms,
    setMetadataImportPrograms,
    metadataImportDetails,
    setMetadataImportDetails,
    metadataImportSelections,
    setMetadataImportSelections,
    metadataImportErrors,
    setMetadataImportErrors,
    isProcessingMetadataImport,
    setIsProcessingMetadataImport,
    isExporting,
    savingPercent,
    savingStatusMessage,
  };
}
