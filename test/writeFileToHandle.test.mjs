import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileToHandle } from "../.tmp-writeFileToHandle.mjs";

const makeFakeHandle = ({ failOnWrite = false } = {}) => {
  const calls = { writes: [], closed: false, aborted: false };
  const writable = {
    write: async (chunk) => {
      if (failOnWrite) throw new Error("disk full");
      calls.writes.push(chunk);
    },
    close: async () => {
      calls.closed = true;
    },
    abort: async () => {
      calls.aborted = true;
    },
  };
  return { fileHandle: { createWritable: async () => writable }, calls };
};

test("writes in chunks, reports progress up to 1, and closes the stream", async () => {
  const { fileHandle, calls } = makeFakeHandle();
  const file = new File([new Uint8Array(10), new Uint8Array(10)], "x.led");
  const progress = [];

  await writeFileToHandle(fileHandle, file, (p) => progress.push(p));

  assert.ok(calls.closed, "expected close() to be called");
  assert.ok(!calls.aborted, "expected no abort on success");
  assert.equal(progress.at(-1), 1, "expected final progress to reach 1");
  assert.ok(calls.writes.length > 0, "expected at least one write() call");
});

test("aborts and rethrows when a chunk write fails", async () => {
  const { fileHandle, calls } = makeFakeHandle({ failOnWrite: true });
  const file = new File([new Uint8Array(10)], "x.led");

  await assert.rejects(() => writeFileToHandle(fileHandle, file), /disk full/);

  assert.ok(calls.aborted, "expected abort() to be called after a failed write");
  assert.ok(!calls.closed, "expected close() NOT to be called after a failed write");
});

test("works without an onProgress callback", async () => {
  const { fileHandle } = makeFakeHandle();
  const file = new File([new Uint8Array(5)], "x.led");

  await writeFileToHandle(fileHandle, file);
});
