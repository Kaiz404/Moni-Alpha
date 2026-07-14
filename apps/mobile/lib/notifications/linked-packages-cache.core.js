/**
 * MMKV snapshot of linked Android package names for the headless notification task.
 * Written by linked-packages-cache.ts when wallets change.
 *
 * CommonJS — required by the headless task in index.js before TS loads.
 */
const { createMMKV } = require('react-native-mmkv');
const { curatedPackagesEquivalent } = require('./notification-package-aliases.core');

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
  return readLinkedPackages().some((linked) =>
    curatedPackagesEquivalent(linked, packageName),
  );
}

function writeLinkedPackages(packages) {
  storage.set(LINKED_PACKAGES_KEY, JSON.stringify(packages));
}

module.exports = {
  isPackageLinked,
  readLinkedPackages,
  writeLinkedPackages,
  LINKED_PACKAGES_KEY,
};
