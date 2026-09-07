// T1000/T8000 .led files start with this magic; confirmed against real program
// files pulled from the field (see test-files/). No public format spec exists,
// so we only assert fields we've verified by diffing known-good samples.
const LED_MAGIC = "rzbv001";
const HEADER_MIN_BYTES = 39;

export type LedHeaderInfo = {
  ok: boolean;
  warnings: string[];
  ledCount: number | null;
};

export const parseLedHeader = (bytes: Uint8Array): LedHeaderInfo => {
  const warnings: string[] = [];

  if (bytes.length < HEADER_MIN_BYTES) {
    return { ok: false, warnings: ["File is too small to be a valid .led program (truncated?)."], ledCount: null };
  }

  const magic = String.fromCharCode(...bytes.slice(0, 7));
  if (magic !== LED_MAGIC) {
    return { ok: false, warnings: [`Missing "${LED_MAGIC}" header — this may not be a T1000/T8000 program file.`], ledCount: null };
  }

  // Constant sync marker seen at this offset in every known-good sample.
  if (bytes[20] !== 0x00 || bytes[21] !== 0x55 || bytes[22] !== 0xaa || bytes[23] !== 0x00) {
    warnings.push("Header sync marker doesn't match known-good files — file may be corrupted.");
  }

  const ledCount = (bytes[37] << 8) | bytes[38];
  if (ledCount === 0 || ledCount > 65535) {
    warnings.push("LED pixel count in header looks invalid.");
  }

  return { ok: true, warnings, ledCount };
};

export const inspectLedFile = async (file: File): Promise<LedHeaderInfo> => {
  const headerBlob = file.slice(0, HEADER_MIN_BYTES);
  const buffer = await headerBlob.arrayBuffer();
  return parseLedHeader(new Uint8Array(buffer));
};

export const hashFile = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const filesMatch = async (a: File, b: File): Promise<boolean> => {
  if (a.size !== b.size) {
    return false;
  }
  const [hashA, hashB] = await Promise.all([hashFile(a), hashFile(b)]);
  return hashA === hashB;
};
