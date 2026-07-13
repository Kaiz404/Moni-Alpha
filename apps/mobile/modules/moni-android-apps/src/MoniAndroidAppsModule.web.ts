import type { InstalledAppInfo } from './MoniAndroidApps.types';

export default {
  async getInstalledLauncherAppsAsync(): Promise<InstalledAppInfo[]> {
    return [];
  },
  async getAppInfoAsync(): Promise<InstalledAppInfo | null> {
    return null;
  },
};
