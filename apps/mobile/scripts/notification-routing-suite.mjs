/**
 * Unit tests for notification wallet candidate routing (no LLM).
 * Run: pnpm --filter moni test:notification-routing
 */

import { curatedPackagesEquivalent } from '../lib/notifications/notification-package-aliases.core.js';

function toAiWalletContext(wallet) {
  return {
    id: wallet.id,
    name: wallet.name ?? '',
    type: wallet.type ?? null,
    currency: wallet.currency ?? null,
    accountHint: wallet.notificationAccountHint?.trim() || null,
  };
}

function resolveNotificationCandidates(packageName, wallets) {
  const linked = wallets.filter(
    (w) => w.notificationPackage && curatedPackagesEquivalent(w.notificationPackage, packageName),
  );
  const candidates = linked.map(toAiWalletContext);
  return {
    candidates,
    lockedWalletId: candidates.length === 1 ? candidates[0].id : null,
  };
}

function resolveNotificationPackageName(notification) {
  const explicit = notification.packageName?.trim();
  if (explicit) return explicit;
  const app = notification.app?.trim();
  if (app) return app;
  return 'unknown';
}

const wallets = [
  {
    id: 'w1',
    name: 'Maybank Spending',
    type: 'bank',
    currency: 'MYR',
    notificationPackage: 'com.maybank2u.life',
    notificationAccountHint: '****4521',
  },
  {
    id: 'w2',
    name: 'Maybank Savings',
    type: 'bank',
    currency: 'MYR',
    notificationPackage: 'com.maybank2u.life',
    notificationAccountHint: 'Savings',
  },
  {
    id: 'w3',
    name: 'Touch n Go',
    type: 'ewallet',
    currency: 'MYR',
    notificationPackage: 'com.tngdigital.ewallet',
    notificationAccountHint: null,
  },
];

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

console.log('notification-routing-suite\n');

{
  const pkg = resolveNotificationPackageName({ app: 'com.maybank2u.life' });
  assert('package from app field', pkg === 'com.maybank2u.life');
}

{
  const pkg = resolveNotificationPackageName({
    app: 'Touch n Go',
    packageName: 'my.com.tngdigital.ewallet',
  });
  assert('packageName takes precedence', pkg === 'my.com.tngdigital.ewallet');
}

{
  const { candidates, lockedWalletId } = resolveNotificationCandidates(
    'my.com.tngdigital.ewallet',
    wallets,
  );
  assert('alias wallet link matches canonical notification package', candidates.length === 1);
  assert('alias wallet link locks wallet', lockedWalletId === 'w3');
}

{
  const { candidates, lockedWalletId } = resolveNotificationCandidates('com.maybank2u.life', wallets);
  assert('shared app: two candidates', candidates.length === 2);
  assert('shared app: no lock', lockedWalletId === null);
  assert('shared app: account hints preserved', candidates.every((c) => c.accountHint));
}

{
  const { candidates } = resolveNotificationCandidates('com.unknown.app', wallets);
  assert('unlinked package: zero candidates', candidates.length === 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
