// The web's sign-in QR holds `moni://sign-in?code=<code>` (the e2e build's scheme is `moni-e2e`). Parsed
// by hand: React Native's URL does not read custom schemes the way a browser does.
const LINK = /^(?:moni|moni-e2e):\/\/\/?sign-in\/?\?(.*)$/;

/** The sign-in code in a scanned QR or an opened link, or null when it is not a Moni sign-in link. */
export function signInCode(scanned: string): string | null {
  const query = LINK.exec(scanned.trim())?.[1];
  if (query === undefined) return null;
  for (const pair of query.split('&')) {
    const [key, value = ''] = pair.split('=');
    if (key !== 'code') continue;
    try {
      const code = decodeURIComponent(value).trim();
      return code === '' ? null : code;
    } catch {
      return null;
    }
  }
  return null;
}
