import React, { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Download, Trash2, PlusCircle, Image as ImageIcon, FilePlus2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// The localStorage bucket where every saved LED program lives.
const STORAGE_KEY = "bansal-lights-led-programs";

type FeedbackMessage = {
  type: "success" | "error";
  message: string;
};

type Program = {
  id: string;
  name: string;
  description: string;
  ledDataUrl: string;
  photoDataUrl: string | null;
  originalLedName: string;
  dateAdded: string;
};

type ProgramFormState = {
  programName: string;
  ledFile: File | null;
  description: string;
  photoFile: File | null;
};

// Build a pristine form state every time we reset.
const getEmptyForm = (): ProgramFormState => ({
  programName: "",
  ledFile: null,
  description: "",
  photoFile: null,
});

// Convert files to base64 data URLs so they can be stored in localStorage.
const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("File read produced unexpected data type"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

function App(): JSX.Element {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [formData, setFormData] = useState<ProgramFormState>(getEmptyForm);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load any existing programs immediately.
  useEffect(() => {
    try {
      const rawPrograms = localStorage.getItem(STORAGE_KEY);
      if (!rawPrograms) {
        return;
      }
      const parsed = JSON.parse(rawPrograms);
      if (Array.isArray(parsed)) {
        setPrograms(parsed as Program[]);
      }
    } catch (error) {
      console.error("⚠️ Could not load saved programs", error);
      setFeedback({
        type: "error",
        message: "Storage read error. ब्राउज़र स्टोरेज पढ़ा नहीं जा सका.",
      });
    }
  }, []);

  // Auto-hide feedback messages after five seconds.
  useEffect(() => {
    if (!feedback) {
      return;
    }
    const timerId = window.setTimeout(() => setFeedback(null), 5000);
    return () => window.clearTimeout(timerId);
  }, [feedback]);

  // Update the form state for text inputs & textarea.
  const handleTextChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    if (name === "programName" || name === "description") {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // Validate LED file selection.
  const handleLedFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const isLedFile = file.name.toLowerCase().endsWith(".led");
    if (!isLedFile) {
      setFormData((prev) => ({ ...prev, ledFile: null }));
      event.target.value = "";
      setFeedback({
        type: "error",
        message: "Please select a .led file. केवल .led फाइल चुनें.",
      });
      console.warn("❌ Invalid LED file selected", file.name);
      return;
    }
    setFormData((prev) => ({
      ...prev,
      ledFile: file,
    }));
    console.log("✅ LED file ready", file.name);
  };

  // Validate optional photo (size & type).
  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setFormData((prev) => ({ ...prev, photoFile: null }));
      return;
    }
    const isValidType = ["image/jpeg", "image/png"].includes(file.type);
    const isValidSize = file.size <= 2 * 1024 * 1024;
    if (!isValidType) {
      event.target.value = "";
      setFeedback({
        type: "error",
        message: "Only JPG or PNG images allowed. सिर्फ JPG/PNG फोटो चलेंगे.",
      });
      console.warn("❌ Invalid image type", file.type);
      return;
    }
    if (!isValidSize) {
      event.target.value = "";
      setFeedback({
        type: "error",
        message: "Image must be under 2MB. फोटो 2MB से कम रखें.",
      });
      console.warn("❌ Photo too large", file.size);
      return;
    }
    setFormData((prev) => ({
      ...prev,
      photoFile: file,
    }));
    console.log("📸 Photo ready", file.name);
  };

  // Return everything to the default state.
  const handleCancel = () => {
    setFormData(getEmptyForm());
    document.querySelectorAll<HTMLInputElement>("input[type='file']").forEach((input) => {
      input.value = ""; // Reset so the same file can be chosen again.
    });
    console.log("↩️ Form cleared by user");
  };

  // Save the new program, including LED data and optional photo.
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData.programName.trim()) {
      setFeedback({
        type: "error",
        message: "Program name is required. प्रोग्राम नाम लिखें.",
      });
      return;
    }
    if (!formData.ledFile) {
      setFeedback({
        type: "error",
        message: "Please choose a .led file. कृपया .led फाइल चुनें.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const [ledDataUrl, photoDataUrl] = await Promise.all([
        readFileAsDataUrl(formData.ledFile),
        formData.photoFile ? readFileAsDataUrl(formData.photoFile) : Promise.resolve<string | null>(null),
      ]);

      const newProgram: Program = {
        id: `${Date.now()}`,
        name: formData.programName.trim(),
        description: formData.description.trim(),
        ledDataUrl,
        photoDataUrl,
        originalLedName: formData.ledFile.name,
        dateAdded: new Date().toISOString(),
      };

      const updatedPrograms: Program[] = [newProgram, ...programs];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPrograms));
      } catch (storageError) {
        console.error("❌ localStorage write failed", storageError);
        setFeedback({
          type: "error",
          message: "Storage full or browser issue. स्टोरेज भर गया या ब्राउज़र समस्या.",
        });
        return;
      }

      setPrograms(updatedPrograms);
      setFormData(getEmptyForm());
      document.querySelectorAll<HTMLInputElement>("input[type='file']").forEach((input) => {
        input.value = "";
      });
      setFeedback({
        type: "success",
        message: "Program saved! प्रोग्राम सेव हो गया.",
      });
      console.log("💾 Program saved", { name: newProgram.name, id: newProgram.id });
    } catch (error) {
      console.error("❌ Saving program failed", error);
      setFeedback({
        type: "error",
        message: "Could not save program. प्रोग्राम सेव नहीं हुआ.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Download a saved LED file with the controller-friendly name.
  const handleDownload = (program: Program) => {
    try {
      const base64 = program.ledDataUrl.split(",")[1];
      if (!base64) {
        throw new Error("Missing LED payload");
      }
      const binary = window.atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      const blob = new Blob([bytes], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "00_program.led";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      window.alert("File downloaded! Copy it to SD card.\nफाइल डाउनलोड हो गई! इसे SD कार्ड में कॉपी करें।");
      console.log("⬇️ Program downloaded", {
        id: program.id,
        originalName: program.originalLedName,
      });
    } catch (error) {
      console.error("❌ Download failed", error);
      setFeedback({
        type: "error",
        message: "Download failed. डाउनलोड नहीं हो पाया.",
      });
    }
  };

  // Remove a program after confirming with the user.
  const handleDelete = (id: string) => {
    const confirmed = window.confirm("Delete this program?\nक्या यह प्रोग्राम हटाना है?");
    if (!confirmed) {
      return;
    }

    const updatedPrograms = programs.filter((program) => program.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPrograms));
      setPrograms(updatedPrograms);
      setFeedback({
        type: "success",
        message: "Program deleted. प्रोग्राम हटाया गया.",
      });
      console.log("🗑️ Program deleted", { id });
    } catch (error) {
      console.error("❌ Delete failed", error);
      setFeedback({
        type: "error",
        message: "Could not delete. हटाया नहीं जा सका.",
      });
    }
  };

  // Wipe the entire catalog (hidden troubleshooting button).
  const handleClearAll = () => {
    const confirmed = window.confirm("Clear all saved programs?\nसब प्रोग्राम हटाने हैं?");
    if (!confirmed) {
      return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
      setPrograms([]);
      setFeedback({
        type: "success",
        message: "All programs cleared. सारे प्रोग्राम हटाए गए.",
      });
      console.log("🧹 All programs cleared");
    } catch (error) {
      console.error("❌ Clear all failed", error);
      setFeedback({
        type: "error",
        message: "Could not clear data. डेटा साफ नहीं हुआ.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <header className="sticky top-0 z-10 bg-bansalBlue px-4 py-6 text-white shadow-md">
        <div className="relative mx-auto flex max-w-4xl flex-col gap-1">
          <button
            type="button"
            className="hidden-troubleshoot-button absolute -top-1 -right-1 text-xs text-white/80"
            onClick={handleClearAll}
            aria-label="Clear all data"
          >
            Reset | रीसेट
          </button>
          <h1 className="text-3xl font-bold tracking-tight">Bansal Lights - LED Catalog</h1>
          <p className="text-lg text-white/90">अपने LED प्रोग्राम्स यहाँ सेव करें</p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 pb-16">
        <Card className="mb-8 border border-secondary bg-white shadow-md">
          <CardHeader className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <PlusCircle className="h-7 w-7 text-bansalBlue" aria-hidden="true" />
              <CardTitle>Add New Program | नया प्रोग्राम जोड़ें</CardTitle>
            </div>
            <CardDescription className="text-base text-slate-600">
              LED फाइल चुनें और सेव करें। सब कुछ आपके फोन में सुरक्षित रहेगा।
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {feedback && (
              <div
                className={`rounded-xl border px-4 py-3 text-base ${
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

            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="programName">Program Name | प्रोग्राम नाम *</Label>
                <Input
                  id="programName"
                  name="programName"
                  value={formData.programName}
                  onChange={handleTextChange}
                  maxLength={50}
                  required
                  placeholder="e.g., Shaadi Entry | शादी एंट्री"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>LED File (.led) | LED फाइल (.led) *</Label>
                <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-slate-600">
                  <FilePlus2 className="mb-2 h-10 w-10 text-bansalBlue" aria-hidden="true" />
                  <span className="text-base mb-1">Tap to choose LED file | LED फाइल चुनें</span>
                  <span className="text-xs text-slate-500">Only .led files are accepted | सिर्फ .led फाइल</span>
                  <input
                    type="file"
                    accept=".led"
                    onChange={handleLedFileChange}
                    className="sr-only"
                  />
                </label>
                {formData.ledFile && (
                  <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
                    ✅ File ready: {formData.ledFile.name}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="description">Description | विवरण (optional)</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleTextChange}
                  maxLength={200}
                  rows={3}
                  placeholder="जैसे: लाल-सफेद चमकती लाइट | e.g., Red-white flashing"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Photo | फोटो (optional)</Label>
                <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-slate-600">
                  <ImageIcon className="mb-2 h-10 w-10 text-bansalBlue" aria-hidden="true" />
                  <span className="text-base mb-1">Add photo | फोटो जोड़ें</span>
                  <span className="text-xs text-slate-500">JPG/PNG, max 2MB | JPG/PNG, अधिकतम 2MB</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={handlePhotoChange}
                    className="sr-only"
                  />
                </label>
                {formData.photoFile && (
                  <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
                    📷 Photo ready: {formData.photoFile.name}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="submit" disabled={isSaving}>
                  💾 Save | सेव करें
                </Button>
                <Button type="button" variant="secondary" onClick={handleCancel}>
                  ✖️ Cancel | रद्द करें
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">Saved Programs | सेव किए गए प्रोग्राम</h2>
          {programs.length === 0 ? (
            <Card className="border-dashed bg-white text-slate-600">
              <CardContent className="space-y-3 py-10 text-center text-base">
                <p className="text-xl">💡 अभी कोई प्रोग्राम सेव नहीं है।</p>
                <p>
                  ऊपर वाला फॉर्म भरिए और "Save | सेव करें" दबाइए। फाइल डाउनलोड करके SD कार्ड में डालें।
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {programs.map((program) => (
                <Card key={program.id} className="flex flex-col overflow-hidden border border-slate-200">
                  {program.photoDataUrl ? (
                    <img
                      src={program.photoDataUrl}
                      alt={`${program.name} preview`}
                      className="h-48 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-48 w-full items-center justify-center bg-slate-100 text-6xl text-slate-400">
                      💡
                    </div>
                  )}
                  <CardContent className="flex flex-1 flex-col gap-3 p-5">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{program.name}</h3>
                      <p className="text-sm text-slate-500">
                        Added: {new Date(program.dateAdded).toLocaleString()}
                      </p>
                    </div>
                    {program.description && (
                      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base text-slate-700 leading-relaxed">
                        {program.description}
                      </p>
                    )}
                    <div className="mt-auto flex flex-col gap-3">
                      <Button type="button" variant="success" onClick={() => handleDownload(program)}>
                        <Download className="h-6 w-6" aria-hidden="true" />
                        📥 Download | डाउनलोड करें
                      </Button>
                      <Button type="button" variant="destructive" onClick={() => handleDelete(program.id)}>
                        <Trash2 className="h-6 w-6" aria-hidden="true" />
                        🗑️ Delete | हटाएं
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
