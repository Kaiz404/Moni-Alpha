import { Platform } from 'react-native';
import { requireNativeModule } from 'expo';

import type { InstalledAppInfo } from './MoniAndroidApps.types';

const stub = {
  async getInstalledAppsAsync(_packageNames: string[]): Promise<InstalledAppInfo[]> {
    return [];
  },
  async getAppInfoAsync(_packageName: string): Promise<InstalledAppInfo | null> {
    return null;
  },
};

export type MoniAndroidAppsModule = typeof stub;

let nativeAvailable = false;

function loadModule(): MoniAndroidAppsModule {
  if (Platform.OS !== 'android') return stub;
  try {
    const mod = requireNativeModule<MoniAndroidAppsModule>('MoniAndroidApps');
    nativeAvailable = true;
    return mod;
  } catch {
    nativeAvailable = false;
    return stub;
  }
}

const module = loadModule();

export function isMoniAndroidAppsNativeAvailable(): boolean {
  return nativeAvailable;
}

export default module;
