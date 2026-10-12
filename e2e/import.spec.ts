import type { Page } from "@playwright/test";
import {
  connectCatalogFolder,
  expect,
  feedback,
  makeLedFile,
  programCard,
  readStoredPrograms,
  test,
  type FakeFs,
} from "./fixtures";

const gateBytes = makeLedFile(1);

// A catalog.json as a full export writes it: one program with its LED file in
// the folder, one whose LED file never made it into the folder, and one that
// was already unlinked when exported.
const backupCatalog = {
  exportedAt: "2025-10-20T08:00:00.000Z",
  programCount: 3,
  programs: [
    {
      id: "prog-a",
      name: "Diwali Gate",
      description: "Front gate",
      dateAdded: "2025-10-01T10:00:00.000Z",
      originalLedName: "diwali-gate.led",
      storedFileName: "prog-a-diwali-gate.led",
      exportedLedFileName: "diwali-gate.led",
      fileSizeBytes: gateBytes.length,
      photoDataUrl: null,
      controller: "t8000",
      isFileMissing: false,
    },
    {
      id: "prog-b",
      name: "Wedding Arch",
      description: "",
      dateAdded: "2025-10-02T10:00:00.000Z",
      originalLedName: "arch.led",
      storedFileName: "prog-b-arch.led",
      exportedLedFileName: "arch.led",
      fileSizeBytes: 8231,
      photoDataUrl: null,
      controller: "t1000",
      isFileMissing: false,
    },
    {
      id: "prog-c",
      name: "Old Sign",
      description: "",
      dateAdded: "2025-10-03T10:00:00.000Z",
      originalLedName: "sign.led",
      storedFileName: "prog-c-sign.led",
      exportedLedFileName: null,
      fileSizeBytes: null,
      photoDataUrl: null,
      controller: "t1000",
      isFileMissing: true,
      notes: "LED file not linked locally",
    },
  ],
};

async function writeBackup(fs: FakeFs, dir = "/backup") {
  await fs.writeFile(`${dir}/catalog.json`, JSON.stringify(backupCatalog));
  await fs.writeFile(`${dir}/diwali-gate.led`, gateBytes);
}

async function startImport(page: Page, option: "Full import" | "Metadata only") {
  await page.getByRole("button", { name: /Import backup/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: new RegExp(option) }).click();
}

const storedByName = async (page: Page) =>
  Object.fromEntries((await readStoredPrograms(page)).map((program) => [program.name, program]));

const metadataReview = (page: Page) => page.locator('[role="dialog"][aria-labelledby="metadata-review-title"]');

test("full import copies LED files into the catalog and flags programs whose file is missing", async ({
  page,
  fs,
}) => {
  await writeBackup(fs);
  await connectCatalogFolder(page, fs, "/catalog");
  await fs.pick("directory", "/backup");
  await startImport(page, "Full import");

  await expect(feedback(page)).toContainText("Imported 3 programs (1 ready, 2 need LED files)");

  const stored = await storedByName(page);
  expect(stored["Diwali Gate"]).toMatchObject({
    id: "prog-a",
    description: "Front gate",
    dateAdded: "2025-10-01T10:00:00.000Z",
    storedFileName: "prog-a-diwali-gate.led",
    fileSizeBytes: gateBytes.length,
    controller: "t8000",
    isFileMissing: false,
  });
  expect(stored["Wedding Arch"]).toMatchObject({ id: "prog-b", isFileMissing: true });
  expect(stored["Old Sign"]).toMatchObject({ id: "prog-c", isFileMissing: true });
  expect(await fs.list("/catalog")).toEqual(["prog-a-diwali-gate.led"]);
  expect(await fs.readFile("/catalog/prog-a-diwali-gate.led")).toEqual(gateBytes);

  await expect(programCard(page, "Diwali Gate")).not.toContainText("LED file not linked yet");
  await expect(programCard(page, "Wedding Arch")).toContainText("LED file not linked yet");
  await expect(programCard(page, "Old Sign")).toContainText("LED file not linked yet");
  await expect(page.getByRole("button", { name: "Copy Wedding Arch to SD card" })).toBeDisabled();
});

test("full import asks for the catalog folder first when none is connected", async ({ page, fs }) => {
  await writeBackup(fs);
  await fs.pick("directory", "/catalog");
  await fs.pick("directory", "/backup");
  await startImport(page, "Full import");

  await expect(feedback(page)).toContainText("Imported 3 programs");
  expect(await fs.list("/catalog")).toEqual(["prog-a-diwali-gate.led"]);
});

test("full import of a folder without catalog.json imports nothing", async ({ page, fs }) => {
  await fs.writeFile("/not-a-backup/diwali-gate.led", gateBytes);
  await connectCatalogFolder(page, fs, "/catalog");
  await fs.pick("directory", "/not-a-backup");
  await startImport(page, "Full import");

  await expect(feedback(page)).toContainText("catalog.json not found in that folder");
  expect(await readStoredPrograms(page)).toEqual([]);
});

test("cancelling the full import folder picker imports nothing", async ({ page, fs }) => {
  await connectCatalogFolder(page, fs, "/catalog");
  await fs.pickFails("directory", "AbortError");
  await startImport(page, "Full import");

  await fs.waitForPickers();
  await expect(page.getByRole("button", { name: /Import backup/ })).toBeEnabled();
  // "Folder ready" from connecting can still be on screen; anything else is an error.
  await expect(feedback(page).filter({ hasNotText: "Folder ready" })).toHaveCount(0);
  expect(await readStoredPrograms(page)).toEqual([]);
});

test("a write failure during full import leaves no partial file and marks the program missing", async ({
  page,
  fs,
}) => {
  await writeBackup(fs);
  await connectCatalogFolder(page, fs, "/catalog");
  await fs.failWrites("/catalog", "QuotaExceededError");
  await fs.pick("directory", "/backup");
  await startImport(page, "Full import");

  await expect(feedback(page)).toContainText("Imported 3 programs. Map LED files to finish setup.");
  expect((await storedByName(page))["Diwali Gate"]).toMatchObject({ isFileMissing: true });
  expect(await fs.list("/catalog")).toEqual([]);
});

test("metadata import links the chosen LED file and leaves the rest pending", async ({ page, fs }) => {
  await writeBackup(fs);
  await fs.pick("open", "/backup/catalog.json");
  await startImport(page, "Metadata only");

  const review = metadataReview(page);
  await expect(review).toContainText("Loaded 3 programs from catalog.json");
  await expect(review.locator(".rounded-2xl", { hasText: "3. Old Sign" })).toContainText(
    "No LED file included in the backup."
  );
  const gateRow = review.locator(".rounded-2xl", { hasText: "1. Diwali Gate" });
  await gateRow.locator('input[type="file"]').setInputFiles({
    name: "gate-v2.led",
    mimeType: "application/octet-stream",
    buffer: gateBytes,
  });
  await expect(gateRow).toContainText("Selected: gate-v2.led");

  // No catalog folder yet, so saving asks for one.
  await fs.pick("directory", "/catalog");
  await review.getByRole("button", { name: "Save to catalog" }).click();

  await expect(feedback(page)).toContainText("Imported 3 programs (1 mapped, 2 pending)");
  await expect(review).toHaveCount(0);
  const stored = await storedByName(page);
  expect(stored["Diwali Gate"]).toMatchObject({
    id: "prog-a",
    originalLedName: "gate-v2.led",
    storedFileName: "prog-a-gate-v2.led",
    fileSizeBytes: gateBytes.length,
    controller: "t8000",
    isFileMissing: false,
  });
  expect(stored["Wedding Arch"]).toMatchObject({ isFileMissing: true });
  expect(stored["Old Sign"]).toMatchObject({ isFileMissing: true });
  expect(await fs.list("/catalog")).toEqual(["prog-a-gate-v2.led"]);
  expect(await fs.readFile("/catalog/prog-a-gate-v2.led")).toEqual(gateBytes);
  await expect(programCard(page, "Wedding Arch")).toContainText("LED file not linked yet");
});

test("metadata import rejects a corrupted LED file", async ({ page, fs }) => {
  await writeBackup(fs);
  await fs.pick("open", "/backup/catalog.json");
  await startImport(page, "Metadata only");

  const gateRow = metadataReview(page).locator(".rounded-2xl", { hasText: "1. Diwali Gate" });
  await gateRow.locator('input[type="file"]').setInputFiles({
    name: "broken.led",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("not an led file"),
  });

  await expect(gateRow).toContainText("This .led file looks corrupted or invalid.");
  await expect(gateRow).toContainText("No LED file selected. Program will stay pending.");
});

test("metadata import of invalid JSON shows an error and opens no review", async ({ page, fs }) => {
  await fs.writeFile("/backup/catalog.json", "{ not json");
  await fs.pick("open", "/backup/catalog.json");
  await startImport(page, "Metadata only");

  await expect(feedback(page)).toContainText("Invalid catalog JSON");
  await expect(metadataReview(page)).toHaveCount(0);
});

test("cancelling the metadata file picker opens no review", async ({ page, fs }) => {
  await fs.pickFails("open", "AbortError");
  await startImport(page, "Metadata only");

  await fs.waitForPickers();
  await expect(page.getByRole("button", { name: /Import backup/ })).toBeEnabled();
  await expect(metadataReview(page)).toHaveCount(0);
  await expect(feedback(page)).toHaveCount(0);
});
