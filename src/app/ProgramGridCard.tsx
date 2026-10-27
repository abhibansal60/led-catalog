import { Download, HardDrive, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { BilingualText } from "@/components/BilingualText";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DEFAULT_CONTROLLER, Program } from "@/lib/catalog";
import { useAppContext } from "./AppContext";
import type { ProgramItemValues } from "./ProgramItem";

export function ProgramGridCard({
  program,
  item,
}: {
  program: Program;
  item: ProgramItemValues;
}): JSX.Element {
  const {
    handleCopyToSdCard,
    handleDownload,
    isFileSystemSupported,
    handleVerifySdCard,
    setEditingProgramId,
    setFormData,
    setActiveTab,
    setShouldRemovePhoto,
    handleDelete,
  } = useAppContext();
  const {
    isFileMissing,
    sizeDisplay,
    controllerLabel,
    isCopying,
    copyPrimaryLabel,
    copySecondaryLabel,
    copyStatus,
    downloadPrimaryLabel,
    downloadSecondaryLabel,
  } = item;

  return (
                        <Card
                          key={program.id}
                          className="flex flex-col overflow-hidden border border-border bg-card"
                        >
                          {program.photoDataUrl ? (
                            <img
                              src={program.photoDataUrl}
                              alt={`${program.name} preview`}
                              className="h-48 w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-48 w-full items-center justify-center bg-muted text-6xl text-muted-foreground/70">
                              💡
                            </div>
                          )}
                          <CardContent className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                            <div className="space-y-2">
                              <h3 className="text-xl font-semibold text-foreground">{program.name}</h3>
                              <div className="space-y-1 text-sm text-muted-foreground">
                                <p>
                                  <span className="font-medium text-foreground">Uploaded:</span>{" "}
                                  {new Date(program.dateAdded).toLocaleString()}
                                </p>
                                <p className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-foreground">File:</span>
                                  <span>{program.originalLedName}</span>
                                  {isFileMissing ? (
                                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                      Pending
                                    </span>
                                  ) : null}
                                </p>
                                <p>
                                  <span className="font-medium text-foreground">Size:</span>{" "}
                                  {sizeDisplay}
                                </p>
                                <p>
                                  <span className="font-medium text-foreground">Controller:</span>{" "}
                                  {controllerLabel}
                                </p>
                              </div>
                            </div>
                            {isFileMissing ? (
                              <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                <BilingualText
                                  primary="LED file not linked yet."
                                  secondary="LED फाइल अभी लिंक नहीं है।"
                                  align="start"
                                  className="items-start text-left"
                                  secondaryClassName="text-xs text-amber-700"
                                />
                              </div>
                            ) : null}
                            {program.description && (
                              <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-base text-foreground leading-relaxed">
                                {program.description}
                              </p>
                            )}
                            <div className="mt-auto flex flex-col gap-3">
                              <Button
                                type="button"
                                variant="success"
                                onClick={() => handleCopyToSdCard(program)}
                                className="h-auto flex-wrap gap-3 whitespace-normal py-4 text-base shadow-lg shadow-emerald-200/50"
                                disabled={isCopying || isFileMissing}
                              >
                                <HardDrive className="h-6 w-6 flex-shrink-0 text-white" aria-hidden="true" />
                                <BilingualText
                                  primary={copyPrimaryLabel}
                                  secondary={copySecondaryLabel}
                                  align="start"
                                  className="gap-0.5 text-left"
                                  secondaryClassName="text-xs text-emerald-100/90"
                                />
                              </Button>
                              {copyStatus && !isFileMissing ? (
                                <div className="space-y-1 rounded-xl border border-border bg-muted/40 p-3" role="status" aria-live="polite">
                                  <div className="h-2 w-full rounded-full bg-muted">
                                    <div
                                      className={`h-full rounded-full ${
                                        copyStatus.status === "error" ? "bg-red-500" : "bg-emerald-500"
                                      }`}
                                      style={{ width: `${copyStatus.progress}%` }}
                                    />
                                  </div>
                                  <p className="text-sm font-medium text-foreground">
                                    {copyStatus.status === "copying" ? (
                                      `Copying… ${copyStatus.progress}%`
                                    ) : copyStatus.status === "verifying" ? (
                                      <BilingualText
                                        primary="Verifying copy…"
                                        secondary="जांच जारी…"
                                        className="items-start text-left"
                                        secondaryClassName="text-xs text-muted-foreground"
                                      />
                                    ) : copyStatus.status === "success" ? (
                                      <BilingualText
                                        primary="Copied and verified!"
                                        secondary="कॉपी हो गया और जांचा गया।"
                                        className="items-start text-left"
                                        secondaryClassName="text-xs text-muted-foreground"
                                      />
                                    ) : (
                                      <BilingualText
                                        primary={copyStatus.message ?? "Copy failed."}
                                        secondary="कॉपी नहीं हो पाया।"
                                        className="items-start text-left"
                                        secondaryClassName="text-xs text-muted-foreground"
                                      />
                                    )}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleDownload(program)}
                                className="w-full sm:flex-1"
                                disabled={isFileMissing}
                              >
                                <Download className="h-5 w-5" aria-hidden="true" />
                                <BilingualText
                                  primary={downloadPrimaryLabel}
                                  secondary={downloadSecondaryLabel}
                                  align="start"
                                  className="items-start text-left"
                                  secondaryClassName="text-xs text-muted-foreground"
                                />
                              </Button>
                              {isFileSystemSupported ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => handleVerifySdCard(program)}
                                  className="w-full sm:flex-1"
                                  disabled={isFileMissing}
                                >
                                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                                  <BilingualText
                                    primary="Verify SD Card"
                                    secondary="SD कार्ड जांचें"
                                    align="start"
                                    className="items-start text-left"
                                    secondaryClassName="text-xs text-muted-foreground"
                                  />
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setEditingProgramId(program.id);
                                  setFormData({
                                    programName: program.name,
                                    ledFile: null,
                                    description: program.description ?? "",
                                    photoFile: null,
                                    controller: program.controller ?? DEFAULT_CONTROLLER,
                                  });
                                  setActiveTab("add");
                                  setShouldRemovePhoto(false);
                                }}
                                className="w-full sm:flex-1"
                              >
                                <Pencil className="h-5 w-5" aria-hidden="true" />
                                <BilingualText
                                  primary="Edit"
                                  secondary="एडिट"
                                  align="start"
                                  className="items-start text-left"
                                  secondaryClassName="text-xs text-muted-foreground"
                                />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleDelete(program.id)}
                                className="w-full border border-transparent text-red-600 hover:border-red-100 hover:bg-red-50 sm:flex-1"
                              >
                                <Trash2 className="h-5 w-5" aria-hidden="true" />
                                <BilingualText
                                  primary="Delete"
                                  secondary="डिलीट"
                                  align="start"
                                  className="items-start text-left"
                                  secondaryClassName="text-xs text-red-500"
                                />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
  );
}
