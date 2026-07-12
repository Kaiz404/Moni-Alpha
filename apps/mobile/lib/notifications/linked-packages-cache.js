/**
 * MMKV snapshot of linked Android package names for the headless notification task.
 * Written by linked-packages-cache.ts when wallets change.
 */
const { createMMKV } = require('react-native-mmkv');

const storage = createMMKV({ id: 'moni-notification-links' });
const LINKED_PACKAGES_KEY = 'linked_packages';

function readLinkedPackages() {
  try {
    const raw = storage.getString(LINKED_PACKAGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string' && p) : [];
  } catch {
    return [];
  }
}

function isPackageLinked(packageName) {
  if (!packageName || packageName === 'unknown') return false;
  return readLinkedPackages().includes(packageName);
}

module.exports = {
  isPackageLinked,
  readLinkedPackages,
};
