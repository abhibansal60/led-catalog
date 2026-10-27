import { FileJson, FolderDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppContext } from "./AppContext";

export function ImportDialog(): JSX.Element {
  const {
    isImporting,
    setIsImportDialogOpen,
    handleStartFullImport,
    handleStartMetadataImport,
  } = useAppContext();

  return (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-dialog-title"
          onClick={() => {
            if (isImporting) {
              return;
            }
            setIsImportDialogOpen(false);
          }}
        >
          <div
            className="w-full max-w-xl space-y-5 rounded-3xl border border-border bg-card p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="import-dialog-title" className="text-xl font-semibold text-foreground">
                  Import catalog backup
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose how you would like to bring saved programs onto this device.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImportDialogOpen(false)}
                className="rounded-full px-2 py-1 text-lg text-muted-foreground transition hover:bg-muted/60"
                aria-label="Close import options"
              >
                ×
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  if (isImporting) {
                    return;
                  }
                  void handleStartFullImport();
                }}
                disabled={isImporting}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-full rounded-2xl border-2 border-dashed border-border bg-background/70 p-4 text-left transition hover:border-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                )}
              >
                <div className="flex items-center gap-3">
                  <FolderDown className="h-6 w-6 text-primary" aria-hidden="true" />
                  <span className="text-base font-semibold text-foreground">Full import</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Copy LED files and catalog.json from a previous export folder.
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isImporting) {
                    return;
                  }
                  void handleStartMetadataImport();
                }}
                disabled={isImporting}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-full rounded-2xl border-2 border-dashed border-border bg-background/70 p-4 text-left transition hover:border-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                )}
              >
                <div className="flex items-center gap-3">
                  <FileJson className="h-6 w-6 text-primary" aria-hidden="true" />
                  <span className="text-base font-semibold text-foreground">Metadata only</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Review programs from catalog.json and link LED files manually.
                </p>
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: metadata imports let you keep program details in sync even if LED files need to be remapped later.
            </p>
          </div>
        </div>
  );
}
