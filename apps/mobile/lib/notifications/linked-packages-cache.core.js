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
const LOCATION_OFF_PACKAGES_KEY = 'location_off_packages';

function readPackages(key) {
  try {
    const raw = storage.getString(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string' && p) : [];
  } catch {
    return [];
  }
}

function readLinkedPackages() {
  return readPackages(LINKED_PACKAGES_KEY);
}

function isPackageLinked(packageName) {
  if (!packageName || packageName === 'unknown') return false;
  return readLinkedPackages().some((linked) =>
    curatedPackagesEquivalent(linked, packageName),
  );
}

/** False only when every wallet linked to this app has "Record where I spend" off. */
function isLocationRecordedForPackage(packageName) {
  if (!packageName || packageName === 'unknown') return true;
  return !readPackages(LOCATION_OFF_PACKAGES_KEY).some((off) =>
    curatedPackagesEquivalent(off, packageName),
  );
}

function writeLinkedPackages(packages, locationOffPackages = []) {
  storage.set(LINKED_PACKAGES_KEY, JSON.stringify(packages));
  storage.set(LOCATION_OFF_PACKAGES_KEY, JSON.stringify(locationOffPackages));
}

module.exports = {
  isPackageLinked,
  isLocationRecordedForPackage,
  readLinkedPackages,
  writeLinkedPackages,
  LINKED_PACKAGES_KEY,
};
