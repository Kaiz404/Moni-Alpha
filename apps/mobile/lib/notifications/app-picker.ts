import { findCuratedAppByPackage } from '@/constants/notification-apps';
import { KNOWN_INSTITUTIONS } from '@/lib/ai/institutions';
import { curatedPackagesEquivalent } from '@/lib/notifications/notification-package-aliases';
import { isOwnNotification } from '@/lib/notifications/review-notification.core.js';

import type { InstalledAppInfo } from './installed-apps';

export type AppPickerRow = InstalledAppInfo & {
  /** A finance app Moni already knows, so it sorts first. Every other app stays in the list. */
  suggested: boolean;
  /** The app this wallet links, when the phone doesn't list it. */
  missing: boolean;
};

function isKnownFinanceApp(packageName: string): boolean {
  return (
    !!findCuratedAppByPackage(packageName) ||
    KNOWN_INSTITUTIONS.some((row) =>
      row.packages.some((known) => curatedPackagesEquivalent(known, packageName)),
    )
  );
}

/** Known finance apps, then the rest, each by name. Moni itself is out, because the listener skips it. */
export function appPickerRows(
  installed: Iterable<InstalledAppInfo>,
  selected: { packageName: string; label: string; iconUri: string | null } | null,
): AppPickerRow[] {
  const rows: AppPickerRow[] = [...installed]
    .filter((app) => !isOwnNotification(app.packageName))
    .map((app) => ({ ...app, suggested: isKnownFinanceApp(app.packageName), missing: false }));
  if (
    selected &&
    !rows.some((row) => curatedPackagesEquivalent(row.packageName, selected.packageName))
  ) {
    rows.push({ ...selected, suggested: false, missing: true });
  }
  return rows.sort(
    (a, b) =>
      Number(b.suggested) - Number(a.suggested) ||
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
  );
}
