import {
  addProgram,
  connectCatalogFolder,
  expect,
  feedback,
  makeLedFile,
  readStoredPrograms,
  test,
  type FakeFs,
} from "./fixtures";
import type { Page } from "@playwright/test";

const gate = { name: "Diwali Gate", ledName: "diwali gate.led", bytes: makeLedFile(1) };
const arch = { name: "Wedding Arch", ledName: "arch.led", bytes: makeLedFile(2, 8192) };

async function seedCatalog(page: Page, fs: FakeFs) {
  await connectCatalogFolder(page, fs, "/catalog");
  await addProgram(page, gate);
  await addProgram(page, arch);
}

async function exportCatalog(page: Page, option: "Full export" | "Quick JSON backup") {
  await page.getByRole("button", { name: /Export backup/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: new RegExp(option) }).click();
}

const expectedRecord = (stored: any) => ({
  id: stored.id,
  name: stored.name,
  description: stored.description,
  dateAdded: stored.dateAdded,
  originalLedName: stored.originalLedName,
  storedFileName: stored.storedFileName,
  fileSizeBytes: stored.fileSizeBytes,
  photoDataUrl: null,
  controller: "t1000",
  isFileMissing: false,
});

test("full export copies every LED file and writes catalog.json, then syncs it", async ({ page, fs, sync }) => {
  await seedCatalog(page, fs);
  await fs.pick("directory", "/backups");
  await exportCatalog(page, "Full export");

  await expect(feedback(page)).toContainText("and synced online");
  const [folder] = await fs.list("/backups");
  expect(folder).toMatch(/^led-catalog-export-\d{4}-\d{2}-\d{2}T/);
  const dir = `/backups/${folder}`;
  expect(await fs.list(dir)).toEqual(["arch.led", "catalog.json", "diwali-gate.led"]);
  expect(await fs.readFile(`${dir}/diwali-gate.led`)).toEqual(gate.bytes);
  expect(await fs.readFile(`${dir}/arch.led`)).toEqual(arch.bytes);

  const stored = await readStoredPrograms(page);
  const byName = (name: string) => stored.find((program) => program.name === name);
  const catalog = await fs.readJson(`${dir}/catalog.json`);
  expect(catalog.programCount).toBe(2);
  expect(catalog.programs).toEqual(
    expect.arrayContaining([
      { ...expectedRecord(byName("Diwali Gate")), exportedLedFileName: "diwali-gate.led" },
      { ...expectedRecord(byName("Wedding Arch")), exportedLedFileName: "arch.led" },
    ])
  );
  expect(sync.posts).toEqual([
    { exportedAt: catalog.exportedAt, programCount: 2, programs: catalog.programs },
  ]);
});

test("full export notes an LED file that vanished from the catalog folder", async ({ page, fs }) => {
  await seedCatalog(page, fs);
  const missing = (await readStoredPrograms(page)).find((program) => program.name === "Wedding Arch");
  await fs.remove(`/catalog/${missing.storedFileName}`);

  await fs.pick("directory", "/backups");
  await exportCatalog(page, "Full export");

  await expect(feedback(page)).toContainText("Export complete");
  const [folder] = await fs.list("/backups");
  expect(await fs.list(`/backups/${folder}`)).toEqual(["catalog.json", "diwali-gate.led"]);
  const catalog = await fs.readJson(`/backups/${folder}/catalog.json`);
  expect(catalog.programs.find((program: any) => program.name === "Wedding Arch")).toMatchObject({
    exportedLedFileName: null,
    notes: "LED file missing or permission denied",
  });
});

test("full export reports a failed sync but keeps the exported folder", async ({ page, fs, sync }) => {
  await seedCatalog(page, fs);
  sync.status = 500;
  await fs.pick("directory", "/backups");
  await exportCatalog(page, "Full export");

  await expect(feedback(page)).toContainText("but online sync failed");
  const [folder] = await fs.list("/backups");
  expect(await fs.exists(`/backups/${folder}/catalog.json`)).toBe(true);
});

test("cancelling the full export folder picker writes and syncs nothing", async ({ page, fs, sync }) => {
  await seedCatalog(page, fs);
  await fs.pickFails("directory", "AbortError");
  await exportCatalog(page, "Full export");

  await fs.waitForPickers();
  await expect(page.getByRole("button", { name: /Export backup/ })).toBeEnabled();
  await expect(feedback(page)).toContainText("Program saved!");
  expect(sync.posts).toEqual([]);
});

test("quick JSON backup saves program metadata and posts the same payload to /api/sync", async ({
  page,
  fs,
  sync,
}) => {
  await seedCatalog(page, fs);
  await fs.pick("save", "/downloads/");
  await exportCatalog(page, "Quick JSON backup");

  await expect(feedback(page)).toContainText("and synced online");
  const [fileName] = await fs.list("/downloads");
  expect(fileName).toMatch(/^led-catalog-backup-.*\.json$/);
  await expect(feedback(page)).toContainText(`saved as "${fileName}"`);

  const stored = await readStoredPrograms(page);
  const backup = await fs.readJson(`/downloads/${fileName}`);
  expect(backup.programCount).toBe(2);
  expect(backup.programs).toEqual(
    expect.arrayContaining(stored.map((program) => ({ ...expectedRecord(program), exportedLedFileName: null })))
  );
  expect(sync.posts).toEqual([
    { exportedAt: backup.exportedAt, programCount: 2, programs: backup.programs },
  ]);

  const { calls } = await fs.state();
  expect(calls.at(-1)).toMatchObject({ kind: "save", options: { suggestedName: fileName } });
});

test("cancelling the quick JSON save dialog writes and syncs nothing", async ({ page, fs, sync }) => {
  await seedCatalog(page, fs);
  await fs.pickFails("save", "AbortError");
  await exportCatalog(page, "Quick JSON backup");

  await fs.waitForPickers();
  await expect(page.getByRole("button", { name: /Export backup/ })).toBeEnabled();
  await expect(feedback(page)).toContainText("Program saved!");
  expect(sync.posts).toEqual([]);
});
