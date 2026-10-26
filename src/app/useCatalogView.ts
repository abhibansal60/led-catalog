import { useMemo } from "react";
import { formatControllerLabel, getProgramController } from "@/lib/catalog";
import type { useAppState } from "./useAppState";
import type { useFileSystem } from "./useFileSystem";
import type { useImportFlow } from "./useImportFlow";
import type { useProgramForm } from "./useProgramForm";
import type { useProgramActions } from "./useProgramActions";
import type { useExportFlow } from "./useExportFlow";

type Deps = ReturnType<typeof useAppState> &
  ReturnType<typeof useFileSystem> &
  ReturnType<typeof useImportFlow> &
  ReturnType<typeof useProgramForm> &
  ReturnType<typeof useProgramActions> &
  ReturnType<typeof useExportFlow>;

export function useCatalogView(s: Deps) {
  const { activeTab, programs, editingProgramId, searchTerm, catalogView } = s;

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
      const controllerValue = getProgramController(program);
      const haystack = `${program.name} ${program.originalLedName} ${program.description} ${controllerValue} ${formatControllerLabel(controllerValue)}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [programs, trimmedSearchTerm]);

  const isGridView = catalogView === "grid";
  const isListView = !isGridView;
  const hasFilteredPrograms = filteredPrograms.length > 0;

  return {
    isViewTab,
    isAddTab,
    isTutorialTab,
    hasPrograms,
    isEditing,
    editingProgram,
    trimmedSearchTerm,
    filteredPrograms,
    isGridView,
    isListView,
    hasFilteredPrograms,
  };
}
