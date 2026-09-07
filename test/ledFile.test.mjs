import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLedHeader } from "../.tmp-ledFile.mjs";

const goodHeader = () => {
  // Mirrors the real 25x40 sample: magic + sync marker + ledCount=1000 at offset 37-38.
  const bytes = new Uint8Array(39);
  const magic = "rzbv001";
  for (let i = 0; i < magic.length; i += 1) bytes[i] = magic.charCodeAt(i);
  bytes[20] = 0x00;
  bytes[21] = 0x55;
  bytes[22] = 0xaa;
  bytes[23] = 0x00;
  bytes[37] = (1000 >> 8) & 0xff;
  bytes[38] = 1000 & 0xff;
  return bytes;
};

test("accepts a well-formed header and reads the LED count", () => {
  const result = parseLedHeader(goodHeader());
  assert.equal(result.ok, true);
  assert.equal(result.ledCount, 1000);
  assert.deepEqual(result.warnings, []);
});

test("rejects a truncated file", () => {
  const result = parseLedHeader(new Uint8Array(10));
  assert.equal(result.ok, false);
  assert.match(result.warnings[0], /too small/);
});

test("rejects a file with the wrong magic bytes", () => {
  const bytes = goodHeader();
  bytes[0] = 0x00;
  const result = parseLedHeader(bytes);
  assert.equal(result.ok, false);
  assert.match(result.warnings[0], /header/);
});

test("warns on a corrupted sync marker but still parses", () => {
  const bytes = goodHeader();
  bytes[21] = 0xff;
  const result = parseLedHeader(bytes);
  assert.equal(result.ok, true);
  assert.match(result.warnings[0], /sync marker/);
});
