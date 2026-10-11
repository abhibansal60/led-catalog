import {
  connectCatalogFolder,
  expect,
  feedback,
  makeLedFile,
  programCard,
  readStoredDirectoryHandle,
  readStoredPrograms,
  submitProgram,
  test,
} from "./fixtures";

const program = { name: "Diwali Gate", ledName: "diwali gate.led", bytes: makeLedFile(1) };

test("saving the first program asks for the catalog folder, writes the LED file and persists the record", async ({
  page,
  fs,
}) => {
  await fs.pick("directory", "/catalog");
  await submitProgram(page, program);

  await expect(feedback(page)).toContainText("Program saved!");
  await expect(programCard(page, "Diwali Gate")).toContainText("File: diwali gate.led");

  const [stored] = await readStoredPrograms(page);
  expect(stored).toMatchObject({
    name: "Diwali Gate",
    originalLedName: "diwali gate.led",
    fileSizeBytes: program.bytes.length,
    controller: "t1000",
    isFileMissing: false,
  });
  expect(stored.storedFileName).toBe(`${stored.id}-diwali-gate.led`);
  expect(await fs.readFile(`/catalog/${stored.storedFileName}`)).toEqual(program.bytes);
  expect(await readStoredDirectoryHandle(page)).toEqual({ kind: "directory", name: "catalog" });

  await page.reload();
  await expect(programCard(page, "Diwali Gate")).toBeVisible();
});

test("cancelling the folder picker saves nothing and shows no error", async ({ page, fs }) => {
  await fs.pickFails("directory", "AbortError");
  await submitProgram(page, program);

  await expect(page.locator("#catalog-add-panel #programName")).toHaveValue("Diwali Gate");
  await expect(page.locator("#catalog-add-panel").getByRole("button", { name: /^Save/ })).toBeEnabled();
  await expect(feedback(page)).toHaveCount(0);
  expect(await readStoredPrograms(page)).toEqual([]);
  expect(await fs.list("/")).toEqual([]);
});

test("denying write permission on the picked folder saves nothing", async ({ page, fs }) => {
  await fs.setPermission("/catalog", { query: "prompt", request: "denied" });
  await fs.pick("directory", "/catalog");
  await submitProgram(page, program);

  await expect(feedback(page)).toContainText("Storage permission denied");
  expect(await readStoredPrograms(page)).toEqual([]);
  expect(await readStoredDirectoryHandle(page)).toBeNull();
  expect(await fs.list("/catalog")).toEqual([]);
});

test("a connected folder whose permission is revoked asks for a folder again", async ({ page, fs }) => {
  await connectCatalogFolder(page, fs, "/catalog");
  await fs.setPermission("/catalog", { query: "prompt", request: "denied" });

  await fs.pick("directory", "/catalog-2");
  await submitProgram(page, program);

  await expect(feedback(page)).toContainText("Program saved!");
  const [stored] = await readStoredPrograms(page);
  expect(await fs.list("/catalog")).toEqual([]);
  expect(await fs.readFile(`/catalog-2/${stored.storedFileName}`)).toEqual(program.bytes);
  expect(await readStoredDirectoryHandle(page)).toEqual({ kind: "directory", name: "catalog-2" });
});
