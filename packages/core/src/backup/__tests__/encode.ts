/** A file's bytes as a picker hands them over. The shared library has neither `Buffer` nor `TextEncoder`. */
export const utf8 = (text: string) =>
  Uint8Array.from(unescape(encodeURIComponent(text)), (char) => char.charCodeAt(0));

export const utf16le = (text: string) =>
  Uint8Array.from([...Array(text.length).keys()].flatMap((at) => [text.charCodeAt(at) & 0xff, text.charCodeAt(at) >> 8]));
