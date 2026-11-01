export type DecodedFile =
  | { kind: 'text'; text: string; encoding: 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252' }
  /** An Excel workbook or anything else that is not text. */
  | { kind: 'workbook' }
  | { kind: 'binary' };

const CHUNK = 8192;

/** Windows-1252's characters for bytes 0x80 to 0x9F, which Latin-1 leaves as control codes. */
const CP1252 = [
  0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152,
  0x8d, 0x17d, 0x8f, 0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122,
  0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178,
];

function fromCodes(codes: number[]): string {
  let text = '';
  for (let at = 0; at < codes.length; at += CHUNK) {
    text += String.fromCharCode(...codes.slice(at, at + CHUNK));
  }
  return text;
}

/** Strict UTF-8, or null at the first invalid sequence. */
function decodeUtf8(bytes: Uint8Array, start: number): string | null {
  const codes: number[] = [];
  let at = start;
  while (at < bytes.length) {
    const lead = bytes[at];
    if (lead < 0x80) {
      codes.push(lead);
      at += 1;
      continue;
    }
    const extra =
      lead >= 0xf0 && lead <= 0xf4 ? 3 : lead >= 0xe0 && lead < 0xf0 ? 2 : lead >= 0xc2 && lead < 0xe0 ? 1 : 0;
    if (!extra || at + extra >= bytes.length) return null;
    let point = lead & (0x3f >> extra);
    for (let next = 1; next <= extra; next += 1) {
      const byte = bytes[at + next];
      if ((byte & 0xc0) !== 0x80) return null;
      point = (point << 6) | (byte & 0x3f);
    }
    if (
      (extra === 2 && (point < 0x800 || (point >= 0xd800 && point <= 0xdfff))) ||
      (extra === 3 && (point < 0x10000 || point > 0x10ffff))
    ) {
      return null;
    }
    if (point >= 0x10000) {
      const offset = point - 0x10000;
      codes.push(0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff));
    } else {
      codes.push(point);
    }
    at += extra + 1;
  }
  return fromCodes(codes);
}

function decodeUtf16(bytes: Uint8Array, start: number, littleEndian: boolean): string {
  const codes: number[] = [];
  for (let at = start; at + 1 < bytes.length; at += 2) {
    codes.push(
      littleEndian ? bytes[at] | (bytes[at + 1] << 8) : (bytes[at] << 8) | bytes[at + 1],
    );
  }
  return fromCodes(codes);
}

function decodeCp1252(bytes: Uint8Array): string {
  const codes: number[] = [];
  for (const byte of bytes) codes.push(byte >= 0x80 && byte < 0xa0 ? CP1252[byte - 0x80] : byte);
  return fromCodes(codes);
}

const startsWith = (bytes: Uint8Array, ...head: number[]) =>
  head.every((byte, index) => bytes[index] === byte);

/** A file with no byte order mark that is UTF-16 has a zero in every second byte of its ASCII. */
function unmarkedUtf16(bytes: Uint8Array): 'utf-16le' | 'utf-16be' | null {
  const sample = Math.min(bytes.length, 512);
  let odd = 0;
  let even = 0;
  for (let at = 0; at < sample; at += 1) {
    if (bytes[at] === 0) {
      if (at % 2) odd += 1;
      else even += 1;
    }
  }
  const half = sample / 2;
  if (odd > half * 0.7 && even === 0) return 'utf-16le';
  if (even > half * 0.7 && odd === 0) return 'utf-16be';
  return null;
}

/**
 * Bank and spreadsheet exports arrive in UTF-8, UTF-16 (Excel's "Unicode text"), or Windows-1252,
 * often with no byte order mark. Anything with no mark that is not valid UTF-8 is read as 1252.
 */
export function decodeFile(bytes: Uint8Array): DecodedFile {
  if (startsWith(bytes, 0xef, 0xbb, 0xbf)) {
    return { kind: 'text', encoding: 'utf-8', text: decodeUtf8(bytes, 3) ?? decodeCp1252(bytes.subarray(3)) };
  }
  if (startsWith(bytes, 0xff, 0xfe)) {
    return { kind: 'text', encoding: 'utf-16le', text: decodeUtf16(bytes, 2, true) };
  }
  if (startsWith(bytes, 0xfe, 0xff)) {
    return { kind: 'text', encoding: 'utf-16be', text: decodeUtf16(bytes, 2, false) };
  }
  if (startsWith(bytes, 0x50, 0x4b, 0x03, 0x04) || startsWith(bytes, 0xd0, 0xcf, 0x11, 0xe0)) {
    return { kind: 'workbook' };
  }
  const utf16 = unmarkedUtf16(bytes);
  if (utf16) {
    return { kind: 'text', encoding: utf16, text: decodeUtf16(bytes, 0, utf16 === 'utf-16le') };
  }
  if (bytes.includes(0)) return { kind: 'binary' };
  const utf8 = decodeUtf8(bytes, 0);
  return utf8 === null
    ? { kind: 'text', encoding: 'windows-1252', text: decodeCp1252(bytes) }
    : { kind: 'text', encoding: 'utf-8', text: utf8 };
}
