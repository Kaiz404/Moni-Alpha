import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'moni-notification-links' });
const ICONS_KEY = 'launcher_icon_by_package';
// Held the small icon of every alert: a one-colour silhouette, not the app's icon.
const RETIRED_ICONS_KEY = 'app_icon_by_package';

let saved: Record<string, string> | null = null;
let listed: ReadonlyMap<string, string> = new Map();

function savedIcons(): Record<string, string> {
  if (saved) return saved;
  storage.remove(RETIRED_ICONS_KEY);
  try {
    saved = JSON.parse(storage.getString(ICONS_KEY) ?? '{}') as Record<string, string>;
  } catch {
    saved = {};
  }
  return saved;
}

/** Icons from the phone's app listing, kept in memory: hundreds of them don't belong in one MMKV value. */
export function rememberListedIcons(icons: ReadonlyMap<string, string>): void {
  listed = icons;
}

/** Keeps one launcher icon across launches. For apps a wallet links or a screen asked for by name. */
export function saveAppIcon(packageName: string, iconUri: string | null): void {
  if (!iconUri?.startsWith('data:image') || savedIcons()[packageName] === iconUri) return;
  saved = { ...savedIcons(), [packageName]: iconUri };
  storage.set(ICONS_KEY, JSON.stringify(saved));
}

export function getCachedAppIcon(packageName: string): string | null {
  return listed.get(packageName) ?? savedIcons()[packageName] ?? null;
}
