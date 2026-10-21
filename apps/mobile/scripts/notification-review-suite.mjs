/**
 * The Android review notification payloads (R2), with no device and no library.
 * Run: pnpm --filter moni test:notification-review
 */

import { createRequire } from 'node:module';
import { deepStrictEqual, strictEqual } from 'node:assert';

const require = createRequire(import.meta.url);
const {
  buildApprovedNotification,
  buildReviewNotification,
  isOwnNotification,
} = require('../lib/notifications/review-notification.core.js');

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed++;
    console.log(`  FAIL ${name}\n       ${error.message}`);
  }
}

const grab = buildReviewNotification({
  proposalId: 'p-grab',
  sourceLabel: 'Maybank alert',
  merchant: 'GRAB',
  amountMinor: 1200,
  currency: 'MYR',
  categoryName: 'Food & Dining',
  firstAlert: false,
});

check('a RM12.00 GRAB capture is titled Maybank alert', () => strictEqual(grab.title, 'Maybank alert'));
check('its body is GRAB · RM12.00', () => strictEqual(grab.body, 'GRAB · RM12.00'));
check('its actions are not-mine, later, approve in that order', () =>
  deepStrictEqual(grab.actionIds, ['not-mine', 'later', 'approve']),
);
check('it carries the proposal id and replaces any earlier notification for it', () => {
  deepStrictEqual(grab.data, { kind: 'review', proposalId: 'p-grab' });
  strictEqual(grab.identifier, 'review-p-grab');
});
check('the first alert after install uses the heads-up channel', () => {
  const first = buildReviewNotification({ ...grabInput(), firstAlert: true });
  strictEqual(first.channelId, 'moni-review-first');
  strictEqual(grab.channelId, 'moni-review');
});
check('thousands take commas', () =>
  strictEqual(
    buildReviewNotification({ ...grabInput(), amountMinor: 111620 }).body,
    'GRAB · RM1,116.20',
  ),
);

const approved = buildApprovedNotification({
  proposalId: 'p-grab',
  merchant: 'GRAB',
  amountMinor: 1200,
  currency: 'MYR',
  outcome: { action: 'approve' },
});
check('after Approve the notification reads Approved with Undo and Don\'t ask about similar', () => {
  strictEqual(approved.title, 'Approved');
  strictEqual(approved.identifier, grab.identifier);
  deepStrictEqual(approved.actionIds, ['undo', 'similar']);
});

check('the capture listener skips Moni\'s own notifications', () => {
  strictEqual(isOwnNotification('com.anonymous.moni'), true);
  strictEqual(isOwnNotification('com.anonymous.moni.e2e'), true);
  strictEqual(isOwnNotification('com.maybank2u.life'), false);
});

function grabInput() {
  return {
    proposalId: 'p-grab',
    sourceLabel: 'Maybank alert',
    merchant: 'GRAB',
    amountMinor: 1200,
    currency: 'MYR',
    categoryName: null,
    firstAlert: false,
  };
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
