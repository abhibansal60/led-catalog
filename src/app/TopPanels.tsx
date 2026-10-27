import {
  BookOpenCheck,
  Download,
  FolderCheck,
  FolderOpen,
  FolderX,
  Loader2,
  PlusCircle,
  Upload,
} from "lucide-react";
import { BilingualText } from "@/components/BilingualText";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppContext } from "./AppContext";

export function TopPanels(): JSX.Element {
  const {
    isFileSystemSupported,
    directoryPermission,
    directoryHandle,
    hasPersistentStorage,
    ensureDirectoryAccess,
    setActiveTab,
    handleImportCatalog,
    isImporting,
    isExporting,
    setIsExportDialogOpen,
    isExportDialogOpen,
    isViewTab,
    isAddTab,
    isTutorialTab,
    feedback,
  } = useAppContext();

  return (
    <>
        {isFileSystemSupported ? (
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border bg-muted/40 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              {directoryPermission === "granted" ? (
                <FolderCheck className="mt-1 h-6 w-6 text-green-600" aria-hidden="true" />
              ) : (
                <FolderX className="mt-1 h-6 w-6 text-amber-600" aria-hidden="true" />
              )}
              <div className="text-sm text-foreground">
                {directoryPermission === "granted" ? (
                  <p className="font-semibold">Folder connected: {directoryHandle?.name}</p>
                ) : (
                  <BilingualText
                    primary="Choose a folder to store LED files"
                    secondary="LED फाइल सेव करने का फोल्डर चुनें"
                    align="start"
                    className="font-semibold"
                    secondaryClassName="text-xs sm:text-sm text-muted-foreground"
                  />
                )}
                <p className="text-muted-foreground">
                  Files stay safely in that folder. When prompted, allow read & write access.
                </p>
                {hasPersistentStorage !== null && (
                  <p
                    className={`text-xs ${
                      hasPersistentStorage ? "text-green-600" : "text-amber-600"
                    }`}
                  >
                    {hasPersistentStorage
                      ? "Persistent storage enabled. कैटलॉग सुरक्षित रहेगा।"
                      : "अगर पूछा जाए तो \"Store on this device\" अनुमति दें ताकि कैटलॉग सुरक्षित रहे।"}
                  </p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void ensureDirectoryAccess({ showSuccessMessage: true });
              }}
            >
              {directoryPermission === "granted" ? (
                <BilingualText
                  primary="Change Folder"
                  secondary="फोल्डर बदलें"
                  secondaryClassName="text-xs text-primary/90"
                />
              ) : (
                <BilingualText
                  primary="Connect Folder"
                  secondary="फोल्डर जोड़ें"
                  secondaryClassName="text-xs text-primary/90"
                />
              )}
            </Button>
          </div>
        ) : (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
            आपका ब्राउज़र यह फीचर नहीं चला सकता। Chrome या Edge (Desktop/Android) का इस्तेमाल करें।
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Quick actions · त्वरित क्रियाएँ
              </h2>
              <BilingualText
                primary="Add new programs easily. Backup tools stay within reach without crowding the page."
                secondary="नए प्रोग्राम आसानी से जोड़ें। बैकअप विकल्प पास में रहें लेकिन पेज पर भीड़ न बनाएं।"
                align="start"
                className="text-left text-sm text-muted-foreground"
                secondaryClassName="text-xs text-muted-foreground/80"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Button
                type="button"
                variant="secondary"
                className="w-full justify-center gap-3 px-5 py-3 sm:w-auto"
                onClick={() => {
                  setActiveTab("add");
                }}
              >
                <PlusCircle className="h-5 w-5" aria-hidden="true" />
                <BilingualText
                  primary="Add Program"
                  secondary="नया प्रोग्राम जोड़ें"
                  align="start"
                  className="items-start text-left"
                  secondaryClassName="text-xs text-muted-foreground"
                />
              </Button>
              <div className="flex w-full flex-col gap-2 rounded-2xl border border-dashed border-border/70 bg-muted/40 p-3 text-left sm:w-auto sm:flex-row sm:items-center sm:gap-3 sm:p-2">
                <div className="flex flex-col text-xs font-medium uppercase tracking-wide text-muted-foreground sm:flex-row sm:items-center sm:gap-2">
                  <span>Backup tools</span>
                  <span className="text-[11px] font-normal capitalize text-muted-foreground/80 sm:text-xs">
                    बैकअप विकल्प
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 rounded-xl border border-border/60 bg-background/80 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      void handleImportCatalog();
                    }}
                    disabled={isImporting}
                    aria-busy={isImporting}
                    title={isImporting ? "Importing backup…" : "Import backup"}
                  >
                    {isImporting ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Upload className="h-5 w-5" aria-hidden="true" />
                    )}
                    <span className="sr-only">{isImporting ? "Importing…" : "Import backup · बैकअप जोड़ें"}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 rounded-xl border border-border/60 bg-background/80 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      if (isExporting) {
                        return;
                      }
                      setIsExportDialogOpen(true);
                    }}
                    disabled={isExporting}
                    aria-haspopup="dialog"
                    aria-expanded={isExportDialogOpen}
                    aria-busy={isExporting}
                    title={isExporting ? "Exporting backup…" : "Export backup"}
                  >
                    {isExporting ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="h-5 w-5" aria-hidden="true" />
                    )}
                    <span className="sr-only">
                      {isExporting
                        ? "Exporting…"
                        : isExportDialogOpen
                        ? "Hide export options · एक्सपोर्ट विकल्प छुपाएँ"
                        : "Export backup · बैकअप सेव करें"}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mb-6">
          <div
            className="flex flex-col gap-2 rounded-2xl border border-border bg-card/80 p-3 shadow-sm sm:flex-row"
            role="tablist"
            aria-label="Catalog sections"
          >
            <Button
              type="button"
              variant={isViewTab ? "primary" : "ghost"}
              id="catalog-view-tab"
              role="tab"
              aria-selected={isViewTab}
              aria-controls="catalog-view-panel"
              onClick={() => setActiveTab("view")}
              className={cn(
                "w-full justify-start gap-3 rounded-xl px-4 py-3 text-base font-semibold transition sm:flex-1",
                isViewTab
                  ? "shadow-md shadow-primary/40 hover:bg-primary/90"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FolderOpen className="h-5 w-5" aria-hidden="true" />
              <BilingualText
                primary="View Catalog"
                secondary="कैटलॉग देखें"
                align="start"
                className="items-start text-left"
                secondaryClassName={cn(
                  "text-xs",
                  isViewTab ? "text-primary-foreground/80" : "text-muted-foreground"
                )}
              />
            </Button>
            <Button
              type="button"
              variant={isAddTab ? "primary" : "ghost"}
              id="catalog-add-tab"
              role="tab"
              aria-selected={isAddTab}
              aria-controls="catalog-add-panel"
              onClick={() => setActiveTab("add")}
              className={cn(
                "w-full justify-start gap-3 rounded-xl px-4 py-3 text-base font-semibold transition sm:flex-1",
                isAddTab
                  ? "shadow-md shadow-primary/40 hover:bg-primary/90"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <PlusCircle className="h-5 w-5" aria-hidden="true" />
              <BilingualText
                primary="Add New Program"
                secondary="नया जोड़ें"
                align="start"
                className="items-start text-left"
                secondaryClassName={cn(
                  "text-xs",
                  isAddTab ? "text-primary-foreground/80" : "text-muted-foreground"
                )}
              />
            </Button>
            <Button
              type="button"
              variant={isTutorialTab ? "primary" : "ghost"}
              id="catalog-tutorial-tab"
              role="tab"
              aria-selected={isTutorialTab}
              aria-controls="catalog-tutorial-panel"
              onClick={() => setActiveTab("tutorial")}
              className={cn(
                "w-full justify-start gap-3 rounded-xl px-4 py-3 text-base font-semibold transition sm:flex-1",
                isTutorialTab
                  ? "shadow-md shadow-primary/40 hover:bg-primary/90"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
              <BilingualText
                primary="Step-by-Step Tutorial"
                secondary="स्टेप-बाय-स्टेप गाइड"
                align="start"
                className="items-start text-left"
                secondaryClassName={cn(
                  "text-xs",
                  isTutorialTab ? "text-primary-foreground/80" : "text-muted-foreground"
                )}
              />
            </Button>
          </div>
        </div>

        {feedback && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-base ${
              feedback.type === "success"
                ? "border-green-200 bg-green-50 text-green-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
            role="status"
            aria-live="polite"
          >
            {feedback.message}
          </div>
        )}
    </>
  );
}
