import { FilePlus2, Image as ImageIcon, Pencil, PlusCircle } from "lucide-react";
import { BilingualText } from "@/components/BilingualText";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CONTROLLER_OPTIONS } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { useAppContext } from "./AppContext";

export function AddProgramTab(): JSX.Element {
  const {
    isEditing,
    handleSubmit,
    formData,
    handleTextChange,
    handleControllerChange,
    handleLedFileChange,
    editingProgram,
    handlePhotoChange,
    shouldRemovePhoto,
    setShouldRemovePhoto,
    isSaving,
    handleCancel,
    savingStatusMessage,
    saveProgress,
    savingPercent,
  } = useAppContext();

  return (
          <section
            id="catalog-add-panel"
            role="tabpanel"
            aria-labelledby="catalog-add-tab"
            className="flex flex-col"
          >
            <Card className="border border-border bg-card shadow-md">
              <CardHeader className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <Pencil className="h-7 w-7 text-primary" aria-hidden="true" />
                ) : (
                  <PlusCircle className="h-7 w-7 text-primary" aria-hidden="true" />
                )}
                <CardTitle>
                  {isEditing ? (
                    <BilingualText
                      primary="Edit Program"
                      secondary="प्रोग्राम बदलें"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-base text-muted-foreground"
                    />
                  ) : (
                    <BilingualText
                      primary="Add New Program"
                      secondary="नया प्रोग्राम जोड़ें"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-base text-muted-foreground"
                    />
                  )}
                </CardTitle>
              </div>
              <CardDescription className="text-base text-muted-foreground">
                {isEditing
                  ? "Update details or add a photo. Leave fields blank to keep current values. बदलाव करें या फोटो जोड़ें।"
                  : "LED फाइल चुनें और सेव करें। सब कुछ आपके फोन में सुरक्षित रहेगा।"}
              </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
              <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                <div className="flex flex-col gap-2">
                  <Label
                    htmlFor="programName"
                    className="space-y-1"
                  >
                    <BilingualText
                      primary="Program Name *"
                      secondary="प्रोग्राम नाम (अनिवार्य)"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-sm text-muted-foreground"
                    />
                  </Label>
                  <Input
                    id="programName"
                    name="programName"
                    value={formData.programName}
                    onChange={handleTextChange}
                    maxLength={50}
                    required
                    placeholder="e.g., Shaadi Entry"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="controller" className="space-y-1">
                    <BilingualText
                      primary="Controller *"
                      secondary="कंट्रोलर (अनिवार्य)"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-sm text-muted-foreground"
                    />
                  </Label>
                  <select
                    id="controller"
                    name="controller"
                    value={formData.controller}
                    onChange={handleControllerChange}
                    className="h-11 rounded-md border border-input bg-background px-3 text-base shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {CONTROLLER_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="space-y-1">
                    <BilingualText
                      primary={isEditing ? "LED File (.led) (optional)" : "LED File (.led) *"}
                      secondary={isEditing ? "LED फाइल (.led) (वैकल्पिक)" : "LED फाइल (.led) (अनिवार्य)"}
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-sm text-muted-foreground"
                    />
                  </Label>
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 px-4 py-6 text-center text-muted-foreground">
                    <FilePlus2 className="mb-2 h-10 w-10 text-primary" aria-hidden="true" />
                    <BilingualText
                      primary="Tap to choose LED file"
                      secondary="LED फाइल चुनें"
                      className="mb-1 items-center text-base"
                      secondaryClassName="text-sm text-muted-foreground/80"
                    />
                    <BilingualText
                      primary={isEditing ? "Leave blank to keep current file." : "Only .led files are accepted."}
                      secondary={isEditing ? "पुरानी फाइल रखने के लिए खाली छोड़ें।" : "केवल .led फाइलें मान्य हैं।"}
                      className="items-center text-sm"
                      secondaryClassName="text-xs text-muted-foreground/80"
                    />
                    <input type="file" accept=".led" onChange={handleLedFileChange} className="sr-only" />
                  </label>
                  {isEditing && editingProgram?.originalLedName && !formData.ledFile && (
                    <p className="rounded-xl border border-border bg-muted/40 px-4 py-2 text-sm text-foreground">
                      Current file: {editingProgram.originalLedName}
                    </p>
                  )}
                  {formData.ledFile && (
                    <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
                      ✅ File ready: {formData.ledFile.name}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="description" className="space-y-1">
                    <BilingualText
                      primary="Description (optional)"
                      secondary="विवरण (वैकल्पिक)"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-sm text-muted-foreground"
                    />
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleTextChange}
                    maxLength={200}
                    rows={3}
                    placeholder="e.g., Red-white flashing"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="space-y-1">
                    <BilingualText
                      primary="Photo (optional)"
                      secondary="फोटो (वैकल्पिक)"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-sm text-muted-foreground"
                    />
                  </Label>
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 px-4 py-6 text-center text-muted-foreground">
                    <ImageIcon className="mb-2 h-10 w-10 text-primary" aria-hidden="true" />
                    <BilingualText
                      primary="Add photo"
                      secondary="फोटो जोड़ें"
                      className="mb-1 items-center text-base"
                      secondaryClassName="text-sm text-muted-foreground/80"
                    />
                    <BilingualText
                      primary="JPG/PNG, max 2MB"
                      secondary="JPG/PNG, अधिकतम 2MB"
                      className="items-center text-sm"
                      secondaryClassName="text-xs text-muted-foreground/80"
                    />
                    <input
                      type="file"
                      accept="image/png, image/jpeg"
                      onChange={handlePhotoChange}
                      className="sr-only"
                    />
                  </label>
                  {isEditing && editingProgram?.photoDataUrl && !shouldRemovePhoto && !formData.photoFile && (
                    <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm">
                      <span className="font-semibold text-foreground">Current photo</span>
                      <img
                        src={editingProgram.photoDataUrl}
                        alt={`${editingProgram.name} current photo`}
                        className="max-h-48 w-full rounded-lg object-cover"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="self-start text-red-600 hover:text-red-700"
                        onClick={() => setShouldRemovePhoto(true)}
                      >
                        <BilingualText
                          primary="Remove photo"
                          secondary="फोटो हटाएं"
                          align="start"
                          className="items-start text-left"
                          secondaryClassName="text-xs text-red-500"
                        />
                      </Button>
                    </div>
                  )}
                  {shouldRemovePhoto && !formData.photoFile && (
                    <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
                      <BilingualText
                        primary="Photo will be removed on save."
                        secondary="फोटो सेव करते समय हट जाएगी।"
                        align="start"
                        className="items-start text-left"
                        secondaryClassName="text-xs text-red-600"
                      />
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShouldRemovePhoto(false)}>
                        <BilingualText
                          primary="Keep photo"
                          secondary="फोटो रखें"
                          align="start"
                          className="items-start text-left"
                          secondaryClassName="text-xs text-muted-foreground"
                        />
                      </Button>
                    </div>
                  )}
                  {formData.photoFile && (
                    <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
                      📷 Photo ready: {formData.photoFile.name}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="submit" disabled={isSaving} className="gap-2">
                    <span aria-hidden="true" className="text-xl">
                      💾
                    </span>
                    {isEditing ? (
                      <BilingualText
                        primary="Update"
                        secondary="अपडेट करें"
                        align="start"
                        className="items-start text-left"
                        secondaryClassName="text-sm text-muted-foreground/80"
                      />
                    ) : (
                      <BilingualText
                        primary="Save"
                        secondary="सेव करें"
                        align="start"
                        className="items-start text-left"
                        secondaryClassName="text-sm text-muted-foreground/80"
                      />
                    )}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => handleCancel("user")} className="gap-2">
                    <span aria-hidden="true" className="text-xl">
                      ✖️
                    </span>
                    <BilingualText
                      primary="Cancel"
                      secondary="रद्द करें"
                      align="start"
                      className="items-start text-left"
                      secondaryClassName="text-sm text-muted-foreground/80"
                    />
                  </Button>
                </div>
                {isSaving ? (
                  <div className="mt-4 w-full">
                    <div
                      role="status"
                      aria-live="polite"
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <span aria-hidden="true">⏳</span>
                      <span>{savingStatusMessage}</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full bg-primary/80 transition-[width]",
                          saveProgress === null ? "saving-progress-bar--indeterminate" : ""
                        )}
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={savingPercent ?? undefined}
                        aria-label="Saving progress"
                        aria-valuetext={savingStatusMessage}
                        style={
                          saveProgress === null
                            ? { width: "40%" }
                            : { width: `${Math.min(100, Math.max(2, savingPercent ?? 0))}%` }
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </form>
            </CardContent>
            </Card>
          </section>
  );
}
