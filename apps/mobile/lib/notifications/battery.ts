import { Platform } from 'react-native';

import { showToast } from '@/lib/toast/toast-store';

import MoniAndroidApps, {
  isMoniAndroidAppsNativeAvailable,
  type AutostartOpened,
} from '../../modules/moni-android-apps';

/** `unavailable` also covers an installed build older than the native functions. */
export type BatteryExemption = 'exempt' | 'not_exempt' | 'unavailable';

export async function readBatteryExemption(): Promise<BatteryExemption> {
  const read = MoniAndroidApps.isIgnoringBatteryOptimizationsAsync;
  if (Platform.OS !== 'android' || !isMoniAndroidAppsNativeAvailable() || !read) {
    return 'unavailable';
  }
  try {
    return (await read()) ? 'exempt' : 'not_exempt';
  } catch {
    return 'unavailable';
  }
}

/** The system prompt, or the battery list where a phone refuses the prompt. */
export async function askForBatteryExemption(): Promise<void> {
  await MoniAndroidApps.requestBatteryExemptionAsync();
}

export async function openBatterySettings(): Promise<void> {
  await MoniAndroidApps.openBatterySettingsAsync();
}

const AUTOSTART_BRANDS = new Set(['xiaomi', 'redmi', 'poco']);

/** MIUI and HyperOS have an Autostart setting on top of Android's battery one. */
export function hasAutostartSetting(brand: string | undefined): boolean {
  return AUTOSTART_BRANDS.has(brand?.trim().toLowerCase() ?? '');
}

export function phoneBrand(): string | undefined {
  return Platform.OS === 'android' ? Platform.constants.Brand : undefined;
}

/** What to tell the user after asking for Autostart: Moni cannot read the setting itself. */
export function autostartFallbackMessage(opened: AutostartOpened): string | null {
  switch (opened) {
    case 'autostart':
      return null;
    case 'app_details':
      return "This phone has no Autostart page Moni can open. Look for Autostart on Moni's App info page.";
    case 'none':
      return "Moni couldn't open Settings. Open Settings and search for Autostart.";
  }
}

export async function openAutostart(): Promise<void> {
  const fallback = autostartFallbackMessage(await MoniAndroidApps.openAutostartSettingsAsync());
  if (fallback) showToast({ text: fallback });
}
