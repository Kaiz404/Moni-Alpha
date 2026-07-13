import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'moni-notification-links' });
const ICONS_KEY = 'app_icon_by_package';

function readIconMap(): Record<string, string> {
  try {
    const raw = storage.getString(ICONS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Persist a base64 data-URI icon from a captured notification. */
export function cacheNotificationAppIcon(packageName: string, iconDataUri: string | undefined) {
  if (!packageName || !iconDataUri?.startsWith('data:image')) return;
  const map = readIconMap();
  map[packageName] = iconDataUri;
  storage.set(ICONS_KEY, JSON.stringify(map));
}

export function getCachedAppIcon(packageName: string): string | null {
  if (!packageName) return null;
  return readIconMap()[packageName] ?? null;
}
