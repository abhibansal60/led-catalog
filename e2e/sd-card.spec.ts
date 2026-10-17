import type { Page } from "@playwright/test";
import { addProgram, connectCatalogFolder, expect, makeLedFile, test, type FakeFs } from "./fixtures";

const gate = { name: "Diwali Gate", ledName: "diwali gate.led", bytes: makeLedFile(1) };

async function seedCardAndCatalog(page: Page, fs: FakeFs) {
  await fs.writeFile("/sd/stale.led", makeLedFile(9));
  await fs.writeFile("/sd/old/notes.txt", "left from last season");
  await connectCatalogFolder(page, fs, "/catalog");
  await addProgram(page, gate);
}

const copyButton = (page: Page) => page.getByRole("button", { name: `Copy ${gate.name} to SD card` });

test("copy to SD card wipes the card, writes a verified copy and a metadata note", async ({
  page,
  fs,
  dialogs,
}) => {
  await seedCardAndCatalog(page, fs);
  await fs.pick("directory", "/sd");
  await copyButton(page).click();

  await expect.poll(() => dialogs.messages.at(-1)).toContain("Copied and verified as 00_program.led");
  expect(dialogs.messages[0]).toContain("This will DELETE everything currently on the SD card");
  expect(await fs.list("/sd")).toEqual(["00_program.led", "Diwali-Gate.txt"]);
  expect(await fs.readFile("/sd/00_program.led")).toEqual(gate.bytes);

  const note = await fs.readText("/sd/Diwali-Gate.txt");
  expect(note).toContain("Program Name: Diwali Gate");
  expect(note).toContain("Original LED File: diwali gate.led");
  expect(note).toContain("Copied As: 00_program.led");
  expect(note).toContain("Controller: T1000");
  expect(note).toContain("Metadata File: Diwali-Gate.txt");
});

test("declining the wipe confirmation leaves the SD card untouched", async ({ page, fs, dialogs }) => {
  await seedCardAndCatalog(page, fs);
  await fs.pick("directory", "/sd");
  dialogs.nextAnswer = false;
  await copyButton(page).click();

  await expect.poll(() => dialogs.messages.length).toBe(1);
  await expect(copyButton(page)).toBeEnabled();
  expect(await fs.list("/sd")).toEqual(["old", "stale.led"]);
});

test("cancelling the SD card picker shows no error", async ({ page, fs, dialogs }) => {
  await seedCardAndCatalog(page, fs);
  await fs.pickFails("directory", "AbortError");
  await copyButton(page).click();

  await fs.waitForPickers();
  await expect(copyButton(page)).toBeEnabled();
  expect(dialogs.messages).toEqual([]);
  expect(await fs.list("/sd")).toEqual(["old", "stale.led"]);
});

test("a blocked SD card folder reports the copy as failed", async ({ page, fs, dialogs }) => {
  await seedCardAndCatalog(page, fs);
  await fs.pickFails("directory", "NotAllowedError");
  await copyButton(page).click();

  await expect.poll(() => dialogs.messages).toEqual([expect.stringContaining("Could not copy to SD card")]);
  expect(await fs.list("/sd")).toEqual(["old", "stale.led"]);
});

test("a write failure on the SD card reports the copy as failed", async ({ page, fs, dialogs }) => {
  await seedCardAndCatalog(page, fs);
  await fs.failWrites("/sd", "NoModificationAllowedError");
  await fs.pick("directory", "/sd");
  await copyButton(page).click();

  await expect.poll(() => dialogs.messages.at(-1)).toContain("Could not copy to SD card");
  expect(dialogs.messages.some((message) => message.includes("Copied and verified"))).toBe(false);
});

test("verify SD card confirms a matching copy", async ({ page, fs, dialogs }) => {
  await seedCardAndCatalog(page, fs);
  await fs.writeFile("/sd/00_program.led", gate.bytes);
  await fs.pick("directory", "/sd");
  await page.getByRole("button", { name: /Verify SD Card/ }).click();

  await expect.poll(() => dialogs.messages.at(-1)).toContain("SD card matches the catalog copy exactly");
});

test("verify SD card flags a copy that differs from the catalog", async ({ page, fs, dialogs }) => {
  await seedCardAndCatalog(page, fs);
  await fs.writeFile("/sd/00_program.led", makeLedFile(2));
  await fs.pick("directory", "/sd");
  await page.getByRole("button", { name: /Verify SD Card/ }).click();

  await expect.poll(() => dialogs.messages.at(-1)).toContain("SD card file does NOT match");
});
