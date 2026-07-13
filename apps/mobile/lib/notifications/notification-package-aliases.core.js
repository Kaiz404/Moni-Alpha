/**
 * Canonical Android package IDs + legacy aliases for curated finance apps.
 * Keep in sync with constants/notification-apps.ts (aliases array on each entry).
 *
 * Used by headless JS (index.js, linked-packages-cache.js) before TS loads.
 */

/** @type {Array<{ canonical: string, aliases?: string[] }>} */
const CURATED_PACKAGE_GROUPS = [
  { canonical: 'com.maybank2u.life' },
  { canonical: 'com.cimb.cimbocto' },
  { canonical: 'com.rhbgroup.rhbmobilebanking' },
  { canonical: 'com.pbb.mypb', aliases: ['com.publicbank.pbbmobile'] },
  { canonical: 'my.com.hongleongconnect.mobileconnect', aliases: ['com.hongleongconnect.mobileconnect'] },
  { canonical: 'com.ambank.ambankonline', aliases: ['com.ambank.amonline'] },
  { canonical: 'com.bankislam.bimbmobile' },
  { canonical: 'com.uob.mightymy', aliases: ['com.uob.uobmighty'] },
  { canonical: 'my.com.hsbc.hsbcmalaysia', aliases: ['com.hsbc.hsbcmy'] },
  {
    canonical: 'air.app.scb.breeze.android.main.my.prod',
    aliases: ['com.sc.mobilebanking.my'],
  },
  { canonical: 'my.com.tngdigital.ewallet', aliases: ['com.tngdigital.ewallet'] },
  { canonical: 'my.com.myboost', aliases: ['com.boostorium.boost'] },
  { canonical: 'me.bigpay.mobile', aliases: ['com.bigpay.mobile'] },
  { canonical: 'com.dbs.sg.dbsmbanking' },
  { canonical: 'com.dbs.dbspaylah' },
  { canonical: 'com.ocbc.mobile' },
  { canonical: 'com.grabtaxi.passenger' },
  { canonical: 'com.phonepe.app' },
  { canonical: 'com.dreamplug.androidapp' },
  { canonical: 'com.paytm.paytm' },
  { canonical: 'com.google.android.apps.nbu.paisa.user' },
];

const canonicalByPackage = new Map();

for (const group of CURATED_PACKAGE_GROUPS) {
  canonicalByPackage.set(group.canonical, group.canonical);
  for (const alias of group.aliases ?? []) {
    canonicalByPackage.set(alias, group.canonical);
  }
}

function canonicalNotificationPackage(packageName) {
  if (!packageName || typeof packageName !== 'string') return packageName;
  const trimmed = packageName.trim();
  return canonicalByPackage.get(trimmed) ?? trimmed;
}

function curatedPackagesEquivalent(a, b) {
  if (!a || !b) return false;
  const left = String(a).trim();
  const right = String(b).trim();
  if (left === right) return true;
  return canonicalNotificationPackage(left) === canonicalNotificationPackage(right);
}

function allCuratedProbePackages() {
  const out = new Set();
  for (const group of CURATED_PACKAGE_GROUPS) {
    out.add(group.canonical);
    for (const alias of group.aliases ?? []) out.add(alias);
  }
  return [...out];
}

module.exports = {
  CURATED_PACKAGE_GROUPS,
  allCuratedProbePackages,
  canonicalNotificationPackage,
  curatedPackagesEquivalent,
};
