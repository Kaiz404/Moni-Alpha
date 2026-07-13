/**
 * MMKV cache of Android app icons (base64 data URIs) keyed by package name.
 * Populated from notification capture when the native listener includes an icon.
 */
const { createMMKV } = require('react-native-mmkv');

const storage = createMMKV({ id: 'moni-notification-links' });
const ICONS_KEY = 'app_icon_by_package';

function readIconMap() {
  try {
    const raw = storage.getString(ICONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function cacheNotificationAppIcon(packageName, iconDataUri) {
  if (!packageName || !iconDataUri || typeof iconDataUri !== 'string') return;
  if (!iconDataUri.startsWith('data:image')) return;
  const map = readIconMap();
  map[packageName] = iconDataUri;
  storage.set(ICONS_KEY, JSON.stringify(map));
}

function getCachedAppIcon(packageName) {
  if (!packageName) return null;
  const map = readIconMap();
  return map[packageName] ?? null;
}

module.exports = {
  cacheNotificationAppIcon,
  getCachedAppIcon,
};
