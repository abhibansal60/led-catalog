import { FileJson, FolderDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppContext } from "./AppContext";

export function ExportDialog(): JSX.Element {
  const { isExporting, setIsExportDialogOpen, handleExportCatalog } = useAppContext();

  return (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-dialog-title"
          onClick={() => {
            if (isExporting) {
              return;
            }
            setIsExportDialogOpen(false);
          }}
        >
          <div
            className="w-full max-w-xl space-y-5 rounded-3xl border border-border bg-card p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="export-dialog-title" className="text-xl font-semibold text-foreground">
                  Export catalog backup
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose how you would like to save programs from this device.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExportDialogOpen(false)}
                className="rounded-full px-2 py-1 text-lg text-muted-foreground transition hover:bg-muted/60"
                aria-label="Close export options"
                disabled={isExporting}
              >
                ×
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  if (isExporting) {
                    return;
                  }
                  setIsExportDialogOpen(false);
                  void handleExportCatalog("full");
                }}
                disabled={isExporting}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-full rounded-2xl border-2 border-dashed border-border bg-background/70 p-4 text-left transition hover:border-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                )}
              >
                <div className="flex items-start gap-3">
                  <FolderDown className="h-6 w-6 text-primary" aria-hidden="true" />
                  <div>
                    <p className="text-base font-semibold text-foreground">Full export</p>
                    <p className="text-xs text-muted-foreground/90">संपूर्ण बैकअप</p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Copy LED files and catalog.json into a backup folder.
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isExporting) {
                    return;
                  }
                  setIsExportDialogOpen(false);
                  void handleExportCatalog("json");
                }}
                disabled={isExporting}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-full rounded-2xl border-2 border-dashed border-border bg-background/70 p-4 text-left transition hover:border-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                )}
              >
                <div className="flex items-start gap-3">
                  <FileJson className="h-6 w-6 text-primary" aria-hidden="true" />
                  <div>
                    <p className="text-base font-semibold text-foreground">Quick JSON backup</p>
                    <p className="text-xs text-muted-foreground/90">त्वरित JSON बैकअप</p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Save catalog metadata only for a fast restore on another device.
                </p>
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: run a full export after major edits to keep LED files and metadata together.
            </p>
          </div>
        </div>
  );
}
