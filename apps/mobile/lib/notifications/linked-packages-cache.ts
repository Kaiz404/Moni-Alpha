import { createMMKV } from 'react-native-mmkv';
import { wallets$ } from '@/lib/store';
import { getRecordValues, isActive } from '@/lib/store/helpers';

const storage = createMMKV({ id: 'moni-notification-links' });
const LINKED_PACKAGES_KEY = 'linked_packages';

type WalletRow = {
  notification_package?: string | null;
  is_active?: boolean | number | null;
  deleted?: boolean;
};

/** Refresh the headless-task MMKV snapshot from the current wallet store. */
export function refreshLinkedPackagesFromStore(): string[] {
  const packages = [
    ...new Set(
      getRecordValues<WalletRow>(wallets$)
        .filter((w) => isActive(w.is_active) && !w.deleted)
        .map((w) => w.notification_package?.trim())
        .filter((p): p is string => Boolean(p)),
    ),
  ];
  storage.set(LINKED_PACKAGES_KEY, JSON.stringify(packages));
  return packages;
}

export function readLinkedPackagesFromCache(): string[] {
  try {
    const raw = storage.getString(LINKED_PACKAGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((p): p is string => typeof p === 'string' && Boolean(p))
      : [];
  } catch {
    return [];
  }
}

export function isPackageLinkedInCache(packageName: string): boolean {
  if (!packageName || packageName === 'unknown') return false;
  return readLinkedPackagesFromCache().includes(packageName);
}
