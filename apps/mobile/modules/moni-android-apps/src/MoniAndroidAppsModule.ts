import { Platform } from 'react-native';
import { requireNativeModule } from 'expo';

import type { AutostartOpened, InstalledAppInfo, ListenerState } from './MoniAndroidApps.types';

const stub = {
  async getInstalledAppsAsync(_packageNames: string[]): Promise<InstalledAppInfo[]> {
    return [];
  },
  async getAppInfoAsync(_packageName: string): Promise<InstalledAppInfo | null> {
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
  getListenerPermissionAsync: undefined as (() => Promise<'authorized' | 'denied'>) | undefined,
  getListenerState: undefined as (() => ListenerState) | undefined,
  /** Asks Android to bind the listener when access is on and it is not bound. True when asked. */
  requestListenerRebind: undefined as (() => boolean) | undefined,
  openListenerSettings: undefined as (() => boolean) | undefined,
  /** Notifications whose capture task Android refused to start, as the listener's JSON payloads. */
  drainCaptureInbox: undefined as (() => string[]) | undefined,
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
