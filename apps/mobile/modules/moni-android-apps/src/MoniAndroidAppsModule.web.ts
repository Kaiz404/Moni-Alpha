import type { InstalledAppInfo } from './MoniAndroidApps.types';

export default {
  async getInstalledAppsAsync(_packageNames: string[]): Promise<InstalledAppInfo[]> {
    return [];
  },
  async getAppInfoAsync(): Promise<InstalledAppInfo | null> {
    return null;
  },
};
