const PUBLIC_PATHS = ['/', '/login', '/delete-account', '/privacy', '/terms'];
const PUBLIC_PREFIXES = ['/auth/'];

export const SIGNED_IN_HOME = '/home';

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function safeNextPath(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : SIGNED_IN_HOME;
}
