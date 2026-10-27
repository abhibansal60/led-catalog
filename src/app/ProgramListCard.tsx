import { Download, HardDrive, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { BilingualText } from "@/components/BilingualText";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DEFAULT_CONTROLLER, Program } from "@/lib/catalog";
import { useAppContext } from "./AppContext";
import type { ProgramItemValues } from "./ProgramItem";

export function ProgramListCard({
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
    sizeDisplay,
    controllerLabel,
    isFileMissing,
    isCopying,
    copyPrimaryLabel,
    copySecondaryLabel,
    copyStatus,
    downloadPrimaryLabel,
    downloadSecondaryLabel,
  } = item;

  return (
                      <Card key={program.id} className="border border-border bg-card">
                        <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 space-y-1">
                              <p className="truncate text-lg font-semibold text-foreground">{program.name}</p>
                              <p className="text-sm text-muted-foreground">File: {program.originalLedName}</p>
                              <p className="text-sm text-muted-foreground">Size: {sizeDisplay}</p>
                              <p className="text-sm text-muted-foreground">Controller: {controllerLabel}</p>
                              {isFileMissing ? (
                                <p className="text-sm font-medium text-amber-700">
                                  <BilingualText
                                    primary="LED file not linked yet"
                                    secondary="LED फाइल अभी लिंक नहीं है"
                                    align="start"
                                    className="items-start text-left"
                                    secondaryClassName="text-xs text-amber-700"
                                  />
                                </p>
                              ) : null}
                            </div>
                            <Button
                              type="button"
                              variant="success"
                              onClick={() => handleCopyToSdCard(program)}
                              disabled={isCopying || isFileMissing}
                              className="h-auto w-full gap-3 px-4 py-3 text-sm shadow-lg shadow-emerald-200/50 sm:w-auto"
                              aria-label={`Copy ${program.name} to SD card`}
                            >
                              <HardDrive className="h-5 w-5 text-white" aria-hidden="true" />
                              <BilingualText
                                primary={copyPrimaryLabel}
                                secondary={copySecondaryLabel}
                                align="start"
                                className="items-start text-left"
                                secondaryClassName="text-xs text-emerald-100/90"
                              />
                            </Button>
                          </div>
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
                                ) : copyStatus.status === "success" ? (
                                  <BilingualText
                                    primary="Copied successfully!"
                                    secondary="कॉपी हो गया।"
                                    className="items-start text-left"
                                    secondaryClassName="text-xs text-muted-foreground"
                                  />
                                ) : (
                                  <BilingualText
                                    primary="Copy failed."
                                    secondary="कॉपी नहीं हो पाया।"
                                    className="items-start text-left"
                                    secondaryClassName="text-xs text-muted-foreground"
                                  />
                                )}
                              </p>
                            </div>
                          ) : null}
                          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleDownload(program)}
                              disabled={isFileMissing}
                              className="w-full sm:flex-1"
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
                                disabled={isFileMissing}
                                className="w-full sm:flex-1"
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
