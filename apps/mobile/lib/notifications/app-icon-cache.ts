import {
  cacheNotificationAppIcon as cacheNotificationAppIconCore,
  getCachedAppIcon as getCachedAppIconCore,
} from './app-icon-cache.core.js';

/** Persist a base64 data-URI icon from a captured notification. */
export function cacheNotificationAppIcon(
  packageName: string,
  iconDataUri: string | undefined,
): void {
  cacheNotificationAppIconCore(packageName, iconDataUri);
}

export function getCachedAppIcon(packageName: string): string | null {
  return getCachedAppIconCore(packageName);
}
