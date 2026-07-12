/** Curated Android package names for common MY/SEA banking and e-wallet apps. */
export type NotificationAppOption = {
  packageName: string;
  label: string;
  region?: string;
};

export const CURATED_NOTIFICATION_APPS: NotificationAppOption[] = [
  { packageName: 'com.maybank2u.life', label: 'Maybank2u', region: 'MY' },
  { packageName: 'com.cimb.cimbocto', label: 'CIMB OCTO', region: 'MY' },
  { packageName: 'com.rhbgroup.rhbmobilebanking', label: 'RHB Mobile Banking', region: 'MY' },
  { packageName: 'com.publicbank.pbbmobile', label: 'Public Bank PB engage', region: 'MY' },
  { packageName: 'com.hongleongconnect.mobileconnect', label: 'HLB Connect', region: 'MY' },
  { packageName: 'com.ambank.amonline', label: 'AmOnline', region: 'MY' },
  { packageName: 'com.bankislam.bimbmobile', label: 'Bank Islam', region: 'MY' },
  { packageName: 'com.ocbc.mobile', label: 'OCBC Digital', region: 'MY' },
  { packageName: 'com.uob.uobmighty', label: 'UOB Mighty', region: 'MY' },
  { packageName: 'com.hsbc.hsbcmy', label: 'HSBC Malaysia', region: 'MY' },
  { packageName: 'com.sc.mobilebanking.my', label: 'Standard Chartered MY', region: 'MY' },
  { packageName: 'com.tngdigital.ewallet', label: 'Touch n Go eWallet', region: 'MY' },
  { packageName: 'com.grabtaxi.passenger', label: 'Grab', region: 'SEA' },
  { packageName: 'com.boostorium.boost', label: 'Boost', region: 'MY' },
  { packageName: 'com.bigpay.mobile', label: 'BigPay', region: 'MY' },
  { packageName: 'com.dbs.sg.dbsmbanking', label: 'DBS digibank', region: 'SG' },
  { packageName: 'com.dbs.dbspaylah', label: 'PayLah!', region: 'SG' },
  { packageName: 'com.ocbc.mobile', label: 'OCBC Digital', region: 'SG' },
  { packageName: 'com.google.android.apps.nbu.paisa.user', label: 'Google Pay', region: 'Global' },
  { packageName: 'com.phonepe.app', label: 'PhonePe', region: 'IN' },
  { packageName: 'com.dreamplug.androidapp', label: 'CRED', region: 'IN' },
  { packageName: 'com.paytm.paytm', label: 'Paytm', region: 'IN' },
];

export function labelForNotificationPackage(packageName: string): string {
  const hit = CURATED_NOTIFICATION_APPS.find((a) => a.packageName === packageName);
  if (hit) return hit.label;
  const parts = packageName.split('.');
  const last = parts[parts.length - 1] ?? packageName;
  return last.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
