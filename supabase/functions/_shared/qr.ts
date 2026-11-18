// The QR sign-in rules, free of Supabase and the network so the tests can call them directly.

export const CODE_TTL_MS = 60_000;
export const REQUEST_TTL_MS = 10 * 60_000;
// A web page that rotates its code every minute starts about one request per visit; ten in a
// request's lifetime leaves room for a few tabs behind one address.
export const STARTS_PER_IP = 10;

/** One sign-in request as the functions read it. A token hash means the phone approved it. */
export type QrRequest = {
  code: string;
  codeExpiresAt: Date;
  expiresAt: Date;
  browser: string;
  tokenHash: string | null;
};

export type PollStep =
  | { kind: 'expired' }
  | { kind: 'approved'; tokenHash: string }
  | { kind: 'rotate'; staleCode: string; nextCodeExpiresAt: Date }
  | { kind: 'waiting'; code: string; codeExpiresAt: Date };

/** What a poll does with the request it found. A missing row and a lapsed one read the same. */
export function pollStep(request: QrRequest | null, now: Date): PollStep {
  if (request === null || request.expiresAt <= now) return { kind: 'expired' };
  if (request.tokenHash !== null) return { kind: 'approved', tokenHash: request.tokenHash };
  if (request.codeExpiresAt <= now) {
    return { kind: 'rotate', staleCode: request.code, nextCodeExpiresAt: codeExpiry(now, request.expiresAt) };
  }
  return { kind: 'waiting', code: request.code, codeExpiresAt: request.codeExpiresAt };
}

export type ApproveCheck =
  | { ok: true; browser: string }
  | { ok: false; reason: 'expired' | 'used' };

/** Whether the phone may approve the request its scanned code points at. */
export function approveCheck(request: QrRequest | null, now: Date): ApproveCheck {
  if (request === null || request.expiresAt <= now || request.codeExpiresAt <= now) {
    return { ok: false, reason: 'expired' };
  }
  if (request.tokenHash !== null) return { ok: false, reason: 'used' };
  return { ok: true, browser: request.browser };
}

/** The next code's lifetime, never past the request's own. */
export function codeExpiry(now: Date, requestExpiresAt: Date): Date {
  return new Date(Math.min(now.getTime() + CODE_TTL_MS, requestExpiresAt.getTime()));
}

const BROWSERS: [RegExp, string][] = [
  [/\bEdg(?:e|A|iOS)?\//, 'Edge'],
  [/\b(?:OPR|Opera)\//, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\b(?:Firefox|FxiOS)\//, 'Firefox'],
  [/\b(?:Chrome|CriOS)\//, 'Chrome'],
  [/\bVersion\/[\d.]+.*\bSafari\//, 'Safari'],
];

const SYSTEMS: [RegExp, string][] = [
  [/\bWindows\b/, 'Windows'],
  [/\b(?:iPhone|iPad|iPod)\b/, 'iOS'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bAndroid\b/, 'Android'],
  [/\bMacintosh\b/, 'Mac'],
  [/\bLinux\b/, 'Linux'],
];

/** "Chrome on Windows" from a User-Agent header, for the phone's "Sign in on …?" question. */
export function browserLabel(userAgent: string | null): string {
  const ua = userAgent ?? '';
  const browser = BROWSERS.find(([pattern]) => pattern.test(ua))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(ua))?.[1];
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? (system ? `a browser on ${system}` : 'a browser');
}

/** The caller's address as the edge sees it: the first hop of X-Forwarded-For. */
export function clientIp(forwardedFor: string | null): string {
  return forwardedFor?.split(',')[0]?.trim() || 'unknown';
}

/** A random URL-safe string with `bytes` bytes of entropy. */
export function randomToken(bytes: number): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
