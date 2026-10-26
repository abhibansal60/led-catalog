import { APP_VERSION, APP_VERSION_DETAILS } from "@/lib/version";
import { useAppState } from "@/app/useAppState";
import { useFileSystem } from "@/app/useFileSystem";
import { useImportFlow } from "@/app/useImportFlow";
import { useProgramForm } from "@/app/useProgramForm";
import { useProgramActions } from "@/app/useProgramActions";
import { useExportFlow } from "@/app/useExportFlow";
import { useCatalogView } from "@/app/useCatalogView";
import { AppContext } from "@/app/AppContext";
import { AppHeader } from "@/app/AppHeader";
import { TopPanels } from "@/app/TopPanels";
import { CatalogTab } from "@/app/CatalogTab";
import { AddProgramTab } from "@/app/AddProgramTab";
import { TutorialTab } from "@/app/TutorialTab";
import { ExportDialog } from "@/app/ExportDialog";
import { ImportDialog } from "@/app/ImportDialog";
import { MetadataReviewDialog } from "@/app/MetadataReviewDialog";

function App(): JSX.Element {
  const appState = useAppState();
  const fileSystem = useFileSystem(appState);
  const importFlow = useImportFlow({ ...appState, ...fileSystem });
  const programForm = useProgramForm({ ...appState, ...fileSystem, ...importFlow });
  const programActions = useProgramActions({ ...appState, ...fileSystem, ...importFlow, ...programForm });
  const exportFlow = useExportFlow({ ...appState, ...fileSystem, ...importFlow, ...programForm, ...programActions });
  const catalogView = useCatalogView({ ...appState, ...fileSystem, ...importFlow, ...programForm, ...programActions, ...exportFlow });
  const app = { ...appState, ...fileSystem, ...importFlow, ...programForm, ...programActions, ...exportFlow, ...catalogView };
  const {
    isViewTab,
    isAddTab,
    isTutorialTab,
    isExportDialogOpen,
    isImportDialogOpen,
    isMetadataReviewOpen,
  } = app;

  return (
    <AppContext.Provider value={app}>
      <div className="min-h-screen bg-background">
        <AppHeader />

        <main className="mx-auto w-full max-w-4xl px-4 py-6 pb-20">
          <TopPanels />

          {isViewTab && <CatalogTab />}

          {isAddTab && <AddProgramTab />}

          {isTutorialTab && <TutorialTab />}
        </main>
        <footer className="border-t border-border bg-muted/40">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:text-sm">
            <span className="font-medium text-foreground">Bansal Lights · LED Catalog</span>
            <span
              className="text-xs text-muted-foreground sm:text-sm"
              title={APP_VERSION_DETAILS ?? undefined}
            >
              Version {APP_VERSION}
            </span>
          </div>
        </footer>
        {isExportDialogOpen ? <ExportDialog /> : null}
        {isImportDialogOpen ? <ImportDialog /> : null}
        {isMetadataReviewOpen ? <MetadataReviewDialog /> : null}
      </div>
    </AppContext.Provider>
  );
}

export default App;
