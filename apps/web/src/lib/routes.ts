const PUBLIC_PATHS = [
  '/',
  '/login',
  '/login/forgot',
  '/login/verify',
  '/login/reset',
  '/delete-account',
  '/delete-account/done',
  '/privacy',
  '/privacy/ms',
  '/terms',
  '/terms/ms',
  '/help',
  '/maintenance',
];
const PUBLIC_PREFIXES = ['/auth/'];
/** Pages a signed-in visitor skips: they go straight to the app. The landing page stays, with a link in. */
const SIGNED_OUT_ONLY = ['/login', '/login/forgot'];

export const SIGNED_IN_HOME = '/home';

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isSignedOutOnly(pathname: string): boolean {
  return SIGNED_OUT_ONLY.includes(pathname);
}

export function safeNextPath(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : SIGNED_IN_HOME;
}

/** Pages that stay up during an update: the maintenance page itself and the legal documents it links. */
const DURING_MAINTENANCE = ['/maintenance', '/privacy', '/privacy/ms', '/terms', '/terms/ms'];

/** While an update runs (`until` is set), every other page shows the maintenance page. */
export function showsMaintenance(pathname: string, until: string | undefined): boolean {
  return Boolean(until) && !DURING_MAINTENANCE.includes(pathname);
}
