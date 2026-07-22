import { Platform } from 'react-native';
import MoniAndroidApps, { isMoniAndroidAppsNativeAvailable } from '../../modules/moni-android-apps';
import type { InstalledAppInfo } from '../../modules/moni-android-apps';
import { allCuratedProbePackages } from '@/lib/notifications/notification-package-aliases';
import { allPackagesForApp, findCuratedAppByPackage } from '@/constants/notification-apps';
import { cacheNotificationAppIcon } from '@/lib/notifications/app-icon-cache';

export type { InstalledAppInfo };

export { isMoniAndroidAppsNativeAvailable };

let installedCache: Map<string, InstalledAppInfo> | null = null;
let loadPromise: Promise<Map<string, InstalledAppInfo>> | null = null;
let nativeUnavailableLogged = false;

function normalizeInstalled(apps: InstalledAppInfo[]): Map<string, InstalledAppInfo> {
  const map = new Map<string, InstalledAppInfo>();
  for (const app of apps) {
    const packageName = app.packageName?.trim();
    if (!packageName) continue;
    const iconUri = app.iconUri?.startsWith('data:image') ? app.iconUri : null;
    if (iconUri) cacheNotificationAppIcon(packageName, iconUri);
    map.set(packageName, {
      packageName,
      label: app.label?.trim() || packageName,
      iconUri,
    });
  }
  return map;
}

function logNativeUnavailableOnce(): void {
  if (nativeUnavailableLogged || isMoniAndroidAppsNativeAvailable()) return;
  nativeUnavailableLogged = true;
  console.warn(
    '[installed-apps] MoniAndroidApps native module is not linked. Rebuild the Android dev client (EAS development build or pnpm --filter moni android).',
  );
}

/** User-facing installed curated finance apps. Android only. */
export async function loadInstalledAppsMap(): Promise<Map<string, InstalledAppInfo>> {
  if (Platform.OS !== 'android') {
    installedCache = new Map();
    return installedCache;
  }
  if (installedCache) return installedCache;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        if (!isMoniAndroidAppsNativeAvailable()) {
          logNativeUnavailableOnce();
          return new Map<string, InstalledAppInfo>();
        }
        const apps = await MoniAndroidApps.getInstalledAppsAsync(allCuratedProbePackages());
        const map = normalizeInstalled(apps);
        if (__DEV__) {
          console.log(`[installed-apps] Loaded ${map.size} installed curated apps`);
        }
        return map;
      } catch (error) {
        console.warn('[installed-apps] Failed to load installed apps:', error);
        return new Map<string, InstalledAppInfo>();
      } finally {
        if (!isMoniAndroidAppsNativeAvailable()) {
          logNativeUnavailableOnce();
        }
      }
    })().then((map) => {
      installedCache = map;
      return map;
    });
  }
  return loadPromise;
}

/** Warm the shared installed-app cache after notification access is enabled. */
export function preloadInstalledApps(): Promise<Map<string, InstalledAppInfo>> {
  return loadInstalledAppsMap();
}

export function getCachedInstalledAppsMap(): Map<string, InstalledAppInfo> | null {
  return installedCache;
}

export function clearInstalledAppsCache(): void {
  installedCache = null;
  loadPromise = null;
}

export async function getInstalledAppInfo(packageName: string): Promise<InstalledAppInfo | null> {
  if (Platform.OS !== 'android' || !packageName.trim()) return null;

  const map = await loadInstalledAppsMap();
  const curated = findCuratedAppByPackage(packageName);
  const probes = curated ? allPackagesForApp(curated) : [packageName.trim()];

  for (const probe of probes) {
    const cached = map.get(probe);
    if (cached) return cached;
  }

  if (!isMoniAndroidAppsNativeAvailable()) {
    logNativeUnavailableOnce();
    return null;
  }

  for (const probe of probes) {
    try {
      const info = await MoniAndroidApps.getAppInfoAsync(probe);
      if (!info?.packageName) continue;
      const normalized = normalizeInstalled([info]);
      const app = normalized.get(info.packageName) ?? null;
      if (app) {
        map.set(app.packageName, app);
        installedCache = map;
        return app;
      }
    } catch {
      // try next alias
    }
  }

  return null;
}

export function isPackageInstalled(
  packageName: string,
  installed: Map<string, InstalledAppInfo>,
): boolean {
  return installed.has(packageName);
}
