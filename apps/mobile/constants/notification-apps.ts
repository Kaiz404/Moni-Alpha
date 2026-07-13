/**
 * Curated Android package names for finance / banking apps.
 *
 * `packageName` is the current Play Store id. `aliases` holds legacy or
 * incorrect ids still seen on devices / in old wallet links.
 *
 * @see apps/mobile/lib/notifications/recent-notification-apps.ts
 */

import {
  canonicalNotificationPackage,
  curatedPackagesEquivalent,
} from '@/lib/notifications/notification-package-aliases';

export type NotificationAppRegion = 'MY' | 'SG' | 'SEA' | 'IN' | 'Global';

export type NotificationAppOption = {
  packageName: string;
  label: string;
  region: NotificationAppRegion;
  sortOrder?: number;
  aliases?: string[];
};

export const NOTIFICATION_REGION_ORDER: NotificationAppRegion[] = [
  'MY',
  'SG',
  'SEA',
  'IN',
  'Global',
];

export const NOTIFICATION_REGION_LABELS: Record<NotificationAppRegion, string> = {
  MY: 'Malaysia',
  SG: 'Singapore',
  SEA: 'Southeast Asia',
  IN: 'India',
  Global: 'Global',
};

const CURATED_NOTIFICATION_APPS_RAW: NotificationAppOption[] = [
  // Malaysia
  { packageName: 'com.maybank2u.life', label: 'Maybank2u', region: 'MY', sortOrder: 1 },
  { packageName: 'com.cimb.cimbocto', label: 'CIMB OCTO', region: 'MY', sortOrder: 2 },
  { packageName: 'com.rhbgroup.rhbmobilebanking', label: 'RHB Mobile Banking', region: 'MY', sortOrder: 3 },
  {
    packageName: 'com.pbb.mypb',
    label: 'MyPB by Public Bank',
    region: 'MY',
    sortOrder: 4,
    aliases: ['com.publicbank.pbbmobile'],
  },
  {
    packageName: 'my.com.hongleongconnect.mobileconnect',
    label: 'HLB Connect',
    region: 'MY',
    sortOrder: 5,
    aliases: ['com.hongleongconnect.mobileconnect'],
  },
  {
    packageName: 'com.ambank.ambankonline',
    label: 'AmOnline',
    region: 'MY',
    sortOrder: 6,
    aliases: ['com.ambank.amonline'],
  },
  { packageName: 'com.bankislam.bimbmobile', label: 'Bank Islam', region: 'MY', sortOrder: 7 },
  {
    packageName: 'com.uob.mightymy',
    label: 'UOB TMRW',
    region: 'MY',
    sortOrder: 8,
    aliases: ['com.uob.uobmighty'],
  },
  {
    packageName: 'my.com.hsbc.hsbcmalaysia',
    label: 'HSBC Malaysia',
    region: 'MY',
    sortOrder: 9,
    aliases: ['com.hsbc.hsbcmy'],
  },
  {
    packageName: 'air.app.scb.breeze.android.main.my.prod',
    label: 'SC Mobile Malaysia',
    region: 'MY',
    sortOrder: 10,
    aliases: ['com.sc.mobilebanking.my'],
  },
  {
    packageName: 'my.com.tngdigital.ewallet',
    label: 'Touch n Go eWallet',
    region: 'MY',
    sortOrder: 11,
    aliases: ['com.tngdigital.ewallet'],
  },
  {
    packageName: 'my.com.myboost',
    label: 'Boost',
    region: 'MY',
    sortOrder: 12,
    aliases: ['com.boostorium.boost'],
  },
  {
    packageName: 'me.bigpay.mobile',
    label: 'BigPay',
    region: 'MY',
    sortOrder: 13,
    aliases: ['com.bigpay.mobile'],
  },
  // Singapore
  { packageName: 'com.dbs.sg.dbsmbanking', label: 'DBS digibank', region: 'SG', sortOrder: 1 },
  { packageName: 'com.dbs.dbspaylah', label: 'PayLah!', region: 'SG', sortOrder: 2 },
  { packageName: 'com.ocbc.mobile', label: 'OCBC Digital', region: 'SG', sortOrder: 3 },
  // SEA (multi-country)
  { packageName: 'com.grabtaxi.passenger', label: 'Grab', region: 'SEA', sortOrder: 1 },
  // India
  { packageName: 'com.phonepe.app', label: 'PhonePe', region: 'IN', sortOrder: 1 },
  { packageName: 'com.dreamplug.androidapp', label: 'CRED', region: 'IN', sortOrder: 2 },
  { packageName: 'com.paytm.paytm', label: 'Paytm', region: 'IN', sortOrder: 3 },
  // Global
  {
    packageName: 'com.google.android.apps.nbu.paisa.user',
    label: 'Google Pay',
    region: 'Global',
    sortOrder: 1,
  },
];

export function dedupeCuratedApps(
  apps: NotificationAppOption[] = CURATED_NOTIFICATION_APPS_RAW,
): NotificationAppOption[] {
  const byPackage = new Map<string, NotificationAppOption>();
  for (const app of apps) {
    const existing = byPackage.get(app.packageName);
    if (!existing) {
      byPackage.set(app.packageName, app);
      continue;
    }
    const regionRank = (r: NotificationAppRegion) => NOTIFICATION_REGION_ORDER.indexOf(r);
    const keepNew =
      regionRank(app.region) < regionRank(existing.region) ||
      (app.region === existing.region &&
        (app.sortOrder ?? 99) < (existing.sortOrder ?? 99));
    if (keepNew) byPackage.set(app.packageName, app);
  }
  return [...byPackage.values()];
}

export const CURATED_NOTIFICATION_APPS = dedupeCuratedApps();

export function allPackagesForApp(app: NotificationAppOption): string[] {
  return [app.packageName, ...(app.aliases ?? [])];
}

export function findCuratedAppByPackage(packageName: string): NotificationAppOption | undefined {
  const trimmed = packageName.trim();
  if (!trimmed) return undefined;
  return CURATED_NOTIFICATION_APPS.find(
    (app) => app.packageName === trimmed || app.aliases?.includes(trimmed),
  );
}

export { canonicalNotificationPackage, curatedPackagesEquivalent };

export function labelForNotificationPackage(packageName: string): string {
  const hit = findCuratedAppByPackage(packageName);
  if (hit) return hit.label;
  const parts = packageName.split('.');
  const last = parts[parts.length - 1] ?? packageName;
  return last.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function regionForNotificationPackage(packageName: string): NotificationAppRegion | null {
  return findCuratedAppByPackage(packageName)?.region ?? null;
}

export function resolveInstalledPackageForCurated(
  installed: Map<string, { packageName: string }>,
  app: NotificationAppOption,
): string | null {
  for (const pkg of allPackagesForApp(app)) {
    if (installed.has(pkg)) return pkg;
  }
  return null;
}

export type NotificationAppSection = {
  region: NotificationAppRegion;
  title: string;
  apps: NotificationAppOption[];
};

export function groupCuratedAppsByRegion(
  excludePackages: Set<string> = new Set(),
): NotificationAppSection[] {
  const sections: NotificationAppSection[] = [];

  for (const region of NOTIFICATION_REGION_ORDER) {
    const apps = dedupeCuratedApps()
      .filter((a) => a.region === region)
      .filter((a) => {
        if (excludePackages.has(a.packageName)) return false;
        return !(a.aliases ?? []).some((alias) => excludePackages.has(alias));
      })
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));

    if (apps.length > 0) {
      sections.push({
        region,
        title: NOTIFICATION_REGION_LABELS[region],
        apps,
      });
    }
  }

  return sections;
}
