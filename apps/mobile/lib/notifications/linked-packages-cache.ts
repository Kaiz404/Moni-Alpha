import { wallets$ } from '@/lib/store';
import { getRecordValues, isActive } from '@/lib/store/helpers';
import { writeLinkedPackages } from './linked-packages-cache.core.js';

export {
  isPackageLinked as isPackageLinkedInCache,
  readLinkedPackages as readLinkedPackagesFromCache,
} from './linked-packages-cache.core.js';

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
  writeLinkedPackages(packages);
  return packages;
}
