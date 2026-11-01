/**
 * Finance apps Moni already knows. Any app on the phone can be linked: this list only puts these
 * first in the picker and names a package no wallet or listing has a label for.
 *
 * `packageName` is the current Play Store id. `aliases` holds legacy or
 * incorrect ids still seen on devices / in old wallet links.
 */

export type NotificationAppOption = {
  packageName: string;
  label: string;
  aliases?: string[];
};

const CURATED_NOTIFICATION_APPS: readonly NotificationAppOption[] = [
  {
    packageName: 'com.maybank2u.life',
    label: 'Maybank2u',
  },
  {
    packageName: 'com.cimb.cimbocto',
    label: 'CIMB OCTO',
  },
  {
    packageName: 'com.rhbgroup.rhbmobilebanking',
    label: 'RHB Mobile Banking',
  },
  {
    packageName: 'com.pbb.mypb',
    label: 'MyPB by Public Bank',
    aliases: ['com.publicbank.pbbmobile'],
  },
  {
    packageName: 'my.com.hongleongconnect.mobileconnect',
    label: 'HLB Connect',
    aliases: ['com.hongleongconnect.mobileconnect'],
  },
  {
    packageName: 'com.ambank.ambankonline',
    label: 'AmOnline',
    aliases: ['com.ambank.amonline'],
  },
  {
    packageName: 'com.bankislam.bimbmobile',
    label: 'Bank Islam',
  },
  {
    packageName: 'com.uob.mightymy',
    label: 'UOB TMRW',
    aliases: ['com.uob.uobmighty'],
  },
  {
    packageName: 'my.com.hsbc.hsbcmalaysia',
    label: 'HSBC Malaysia',
    aliases: ['com.hsbc.hsbcmy'],
  },
  {
    packageName: 'air.app.scb.breeze.android.main.my.prod',
    label: 'SC Mobile Malaysia',
    aliases: ['com.sc.mobilebanking.my'],
  },
  {
    packageName: 'my.com.tngdigital.ewallet',
    label: 'Touch n Go eWallet',
    aliases: ['com.tngdigital.ewallet'],
  },
  {
    packageName: 'my.com.myboost',
    label: 'Boost',
    aliases: ['com.boostorium.boost'],
  },
  {
    packageName: 'me.bigpay.mobile',
    label: 'BigPay',
    aliases: ['com.bigpay.mobile'],
  },
  {
    packageName: 'com.dbs.sg.dbsmbanking',
    label: 'DBS digibank',
  },
  {
    packageName: 'com.dbs.dbspaylah',
    label: 'PayLah!',
  },
  {
    packageName: 'com.ocbc.mobile',
    label: 'OCBC Digital',
  },
  {
    packageName: 'com.grabtaxi.passenger',
    label: 'Grab',
  },
  {
    packageName: 'com.phonepe.app',
    label: 'PhonePe',
  },
  {
    packageName: 'com.dreamplug.androidapp',
    label: 'CRED',
  },
  {
    packageName: 'com.paytm.paytm',
    label: 'Paytm',
  },
  {
    packageName: 'com.google.android.apps.nbu.paisa.user',
    label: 'Google Pay',
  },
];

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

export function labelForNotificationPackage(packageName: string): string {
  const hit = findCuratedAppByPackage(packageName);
  if (hit) return hit.label;
  const parts = packageName.split('.');
  const last = parts[parts.length - 1] ?? packageName;
  return last.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
