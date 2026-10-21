import { wallets$ } from '@/lib/store';
import { getRecordValues, isActive } from '@/lib/store/helpers';
import { writeLinkedPackages } from './linked-packages-cache.core.js';

export {
  isLocationRecordedForPackage,
  isPackageLinked as isPackageLinkedInCache,
  readLinkedPackages as readLinkedPackagesFromCache,
} from './linked-packages-cache.core.js';

type WalletRow = {
  notification_package?: string | null;
  is_active?: boolean | number | null;
  record_location?: boolean | null;
  deleted?: boolean;
};

/** Refresh the headless-task MMKV snapshot from the current wallet store. */
export function refreshLinkedPackagesFromStore(): string[] {
  const recordsLocation = new Map<string, boolean>();
  for (const wallet of getRecordValues<WalletRow>(wallets$)) {
    const pkg = wallet.notification_package?.trim();
    if (!pkg || !isActive(wallet.is_active) || wallet.deleted) continue;
    recordsLocation.set(pkg, recordsLocation.get(pkg) === true || wallet.record_location !== false);
  }
  const packages = [...recordsLocation.keys()];
  writeLinkedPackages(
    packages,
    packages.filter((pkg) => !recordsLocation.get(pkg)),
  );
  return packages;
}
