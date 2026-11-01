import type { AutostartOpened, InstalledAppInfo } from './MoniAndroidApps.types';

export default {
  async getInstalledAppsAsync(_packageNames: string[]): Promise<InstalledAppInfo[]> {
    return [];
  },
  async getAppInfoAsync(): Promise<InstalledAppInfo | null> {
    return null;
  },
  listLaunchableAppsAsync: undefined as (() => Promise<InstalledAppInfo[]>) | undefined,
  setKeyboardPansWindowAsync: undefined as ((pans: boolean) => Promise<void>) | undefined,
  hasGoogleMapsKey: undefined as (() => boolean) | undefined,
  isIgnoringBatteryOptimizationsAsync: undefined as (() => Promise<boolean>) | undefined,
  async requestBatteryExemptionAsync(): Promise<boolean> {
    return false;
  },
  async openBatterySettingsAsync(): Promise<boolean> {
    return false;
  },
  async openAutostartSettingsAsync(): Promise<AutostartOpened> {
    return 'none';
  },
};
