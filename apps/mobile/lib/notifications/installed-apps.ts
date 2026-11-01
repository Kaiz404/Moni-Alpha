import { Platform } from 'react-native';

import MoniAndroidApps, { isMoniAndroidAppsNativeAvailable } from '../../modules/moni-android-apps';
import type { InstalledAppInfo } from '../../modules/moni-android-apps';
import { allPackagesForApp, findCuratedAppByPackage } from '@/constants/notification-apps';
import { getCachedAppIcon, rememberListedIcons, saveAppIcon } from '@/lib/notifications/app-icon-cache';
import { readLinkedPackages } from '@/lib/notifications/linked-packages-cache.core.js';
import { allCuratedProbePackages } from '@/lib/notifications/notification-package-aliases';

export type { InstalledAppInfo };

export { isMoniAndroidAppsNativeAvailable };

let installedCache: Map<string, InstalledAppInfo> | null = null;
let listing: Promise<Map<string, InstalledAppInfo>> | null = null;

function normalized(app: InstalledAppInfo): InstalledAppInfo | null {
  const packageName = app.packageName?.trim();
  if (!packageName) return null;
  return {
    packageName,
    label: app.label?.trim() || packageName,
    iconUri: app.iconUri?.startsWith('data:image') ? app.iconUri : null,
  };
}

/** False on a build from before the launcher query: it can only look up the packages it names. */
export function canListEveryApp(): boolean {
  return (
    Platform.OS === 'android' &&
    isMoniAndroidAppsNativeAvailable() &&
    typeof MoniAndroidApps.listLaunchableAppsAsync === 'function'
  );
}

async function listFromPhone(): Promise<Map<string, InstalledAppInfo>> {
  const apps = canListEveryApp()
    ? await MoniAndroidApps.listLaunchableAppsAsync!()
    : await MoniAndroidApps.getInstalledAppsAsync(allCuratedProbePackages());
  const map = new Map<string, InstalledAppInfo>();
  const icons = new Map<string, string>();
  for (const app of apps) {
    const clean = normalized(app);
    if (!clean) continue;
    map.set(clean.packageName, clean);
    if (clean.iconUri) icons.set(clean.packageName, clean.iconUri);
  }
  rememberListedIcons(icons);
  return map;
}

/**
 * Asks the phone again, because the user may have just installed the app they came to link. The
 * last answer stays in `getCachedInstalledAppsMap` until this one arrives.
 */
export function refreshInstalledApps(): Promise<Map<string, InstalledAppInfo>> {
  if (Platform.OS !== 'android' || !isMoniAndroidAppsNativeAvailable()) {
    return Promise.resolve(new Map());
  }
  listing ??= listFromPhone()
    .then((map) => {
      installedCache = map;
      return map;
    })
    .catch((error) => {
      console.warn('[installed-apps] Failed to list apps:', error);
      return installedCache ?? new Map<string, InstalledAppInfo>();
    })
    .finally(() => {
      listing = null;
    });
  return listing;
}

export function getCachedInstalledAppsMap(): Map<string, InstalledAppInfo> | null {
  return installedCache;
}

/** One app by name, with no full listing. Its icon is kept, so the next launch has it at once. */
export async function getInstalledAppInfo(packageName: string): Promise<InstalledAppInfo | null> {
  const trimmed = packageName.trim();
  if (Platform.OS !== 'android' || !trimmed || !isMoniAndroidAppsNativeAvailable()) return null;

  const curated = findCuratedAppByPackage(trimmed);
  const probes = curated ? allPackagesForApp(curated) : [trimmed];
  for (const probe of probes) {
    const listed = installedCache?.get(probe);
    if (listed) return listed;
  }
  for (const probe of probes) {
    try {
      const info = await MoniAndroidApps.getAppInfoAsync(probe);
      const app = info && normalized(info);
      if (!app) continue;
      saveAppIcon(trimmed, app.iconUri);
      return app;
    } catch {
      // try the next alias
    }
  }
  return null;
}

/** So a screen that only reads `getCachedAppIcon` shows the real icon for what the wallets link. */
export async function fillLinkedAppIcons(): Promise<void> {
  for (const packageName of readLinkedPackages()) {
    if (!getCachedAppIcon(packageName)) await getInstalledAppInfo(packageName);
  }
}
