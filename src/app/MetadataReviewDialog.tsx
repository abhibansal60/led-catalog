import { Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppContext } from "./AppContext";

export function MetadataReviewDialog(): JSX.Element {
  const {
    metadataImportDetails,
    handleCancelMetadataImport,
    isProcessingMetadataImport,
    metadataImportPrograms,
    metadataImportSelections,
    metadataImportErrors,
    handleMetadataFileSelect,
    handleClearMetadataSelection,
    handleConfirmMetadataImport,
  } = useAppContext();

  return (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-background/90 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="metadata-review-title"
        >
          <div className="mx-auto w-full max-w-5xl space-y-5 rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="metadata-review-title" className="text-2xl font-semibold text-foreground">
                  Map LED files to imported programs
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select LED files to copy into the connected folder. Skip any you will link later.
                </p>
                {metadataImportDetails ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Loaded {metadataImportDetails.programCount} programs from {metadataImportDetails.fileName}
                    {metadataImportDetails.exportedAt
                      ? ` · Exported ${new Date(metadataImportDetails.exportedAt).toLocaleString()}`
                      : ""}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleCancelMetadataImport}
                className="rounded-full px-2 py-1 text-lg text-muted-foreground transition hover:bg-muted/60"
                aria-label="Close metadata import"
                disabled={isProcessingMetadataImport}
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              {metadataImportPrograms.map((program, index) => {
                const selectedFile = metadataImportSelections[program.tempId];
                const errorMessage = metadataImportErrors[program.tempId];
                const inputId = `metadata-led-${program.tempId}`;
                return (
                  <div
                    key={program.tempId}
                    className="rounded-2xl border border-border/70 bg-muted/30 p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
                      <div className="space-y-2">
                        <p className="text-base font-semibold text-foreground">
                          {index + 1}. {program.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Suggested LED name: {program.originalLedName}
                        </p>
                        {program.exportedLedFileName ? (
                          <p className="text-xs text-muted-foreground">
                            Backup file: {program.exportedLedFileName}
                          </p>
                        ) : (
                          <p className="text-xs text-amber-600">
                            No LED file included in the backup.
                          </p>
                        )}
                        {program.notes ? (
                          <p className="text-xs text-muted-foreground">Notes: {program.notes}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <input
                          id={inputId}
                          type="file"
                          accept=".led"
                          className="sr-only"
                          onChange={(event) => handleMetadataFileSelect(program.tempId, event)}
                          disabled={isProcessingMetadataImport}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <label
                            htmlFor={inputId}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "cursor-pointer px-4",
                              isProcessingMetadataImport ? "pointer-events-none opacity-60" : ""
                            )}
                          >
                            {selectedFile ? "Change LED file" : "Choose LED file"}
                          </label>
                          {selectedFile ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleClearMetadataSelection(program.tempId)}
                              disabled={isProcessingMetadataImport}
                            >
                              Clear
                            </Button>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {selectedFile
                            ? `Selected: ${selectedFile.name}`
                            : "No LED file selected. Program will stay pending."}
                        </p>
                        {errorMessage ? (
                          <p className="text-xs font-medium text-red-600">{errorMessage}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancelMetadataImport}
                disabled={isProcessingMetadataImport}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (isProcessingMetadataImport) {
                    return;
                  }
                  void handleConfirmMetadataImport();
                }}
                disabled={isProcessingMetadataImport}
              >
                {isProcessingMetadataImport ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Saving…
                  </span>
                ) : (
                  "Save to catalog"
                )}
              </Button>
            </div>
          </div>
        </div>
  );
}
