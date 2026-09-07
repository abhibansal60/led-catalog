import { test } from "node:test";
import assert from "node:assert/strict";
import { clearDirectoryContents } from "../.tmp-clearDirectoryContents.mjs";

const makeFakeDirectory = (fileNames) => {
  const removed = [];
  return {
    directory: {
      entries: async function* () {
        for (const name of fileNames) {
          yield [name, { kind: "file", name }];
        }
      },
      removeEntry: async (name, options) => {
        removed.push({ name, recursive: options?.recursive });
      },
    },
    removed,
  };
};

test("removes every entry in the directory", async () => {
  const { directory, removed } = makeFakeDirectory(["00_program.led", "notes.txt", "old-folder"]);

  await clearDirectoryContents(directory);

  assert.deepEqual(
    removed,
    ["00_program.led", "notes.txt", "old-folder"].map((name) => ({ name, recursive: true }))
  );
});

test("does nothing on an empty directory", async () => {
  const { directory, removed } = makeFakeDirectory([]);

  await clearDirectoryContents(directory);

  assert.deepEqual(removed, []);
});
