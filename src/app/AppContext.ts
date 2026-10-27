import { createContext, useContext } from "react";

import type { useAppState } from "./useAppState";
import type { useFileSystem } from "./useFileSystem";
import type { useImportFlow } from "./useImportFlow";
import type { useProgramForm } from "./useProgramForm";
import type { useProgramActions } from "./useProgramActions";
import type { useExportFlow } from "./useExportFlow";
import type { useCatalogView } from "./useCatalogView";

export type AppContextValue = ReturnType<typeof useAppState> &
  ReturnType<typeof useFileSystem> &
  ReturnType<typeof useImportFlow> &
  ReturnType<typeof useProgramForm> &
  ReturnType<typeof useProgramActions> &
  ReturnType<typeof useExportFlow> &
  ReturnType<typeof useCatalogView>;

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error("useAppContext must be called inside AppContext.Provider");
  }
  return value;
}
