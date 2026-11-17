/**
 * The Android review notification payloads (`XA-Notification`), with no device and no library.
 * Run: pnpm --filter moni test:notification-review
 */

import { createRequire } from 'node:module';
import { deepStrictEqual, strictEqual } from 'node:assert';

const require = createRequire(import.meta.url);
const {
  ACCENT,
  addToAutoAddedDigest,
  buildApprovedNotification,
  buildAutoAddedDigestNotification,
  buildAutoAddedNotification,
  buildReviewNotification,
  buildSetAsideNotification,
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

function grabInput() {
  return {
    proposalId: 'p-grab',
    bankName: 'Maybank',
    merchant: 'GRAB*FOOD',
    amountMinor: 2340,
    currency: 'MYR',
    type: 'expense',
    alertText: "MAYBANK: You've spent RM23.40 at GRAB*FOOD on 14/10 12:41.",
    categoryName: 'Food & Dining',
    seenCount: 14,
    firstAlert: false,
  };
}

const grab = buildReviewNotification(grabInput());

check('a RM23.40 GRAB*FOOD capture is titled GRAB*FOOD · −RM23.40', () =>
  strictEqual(grab.title, 'GRAB*FOOD · −RM23.40'),
);
check('the bank goes in the header beside Moni', () => strictEqual(grab.subtitle, 'Maybank'));
check('the body is the alert as sent, then Moni\'s category and how often', () =>
  strictEqual(
    grab.body,
    "MAYBANK: You've spent RM23.40 at GRAB*FOOD on 14/10 12:41.\nMoni: Food & Dining, like the last 14 times.",
  ),
);
check('one earlier match reads like last time, none just names the category', () => {
  strictEqual(
    buildReviewNotification({ ...grabInput(), seenCount: 1, alertText: null }).body,
    'Moni: Food & Dining, like last time.',
  );
  strictEqual(
    buildReviewNotification({ ...grabInput(), seenCount: 0, alertText: null }).body,
    'Moni: Food & Dining.',
  );
});
check('its actions are not-mine, later, approve in that order', () =>
  deepStrictEqual(grab.actionIds, ['not-mine', 'later', 'approve']),
);
check('it carries the proposal id and replaces any earlier notification for it', () => {
  deepStrictEqual(grab.data, { kind: 'review', proposalId: 'p-grab' });
  strictEqual(grab.identifier, 'review-p-grab');
});
check('the first alert after install uses the heads-up channel', () => {
  strictEqual(buildReviewNotification({ ...grabInput(), firstAlert: true }).channelId, 'moni-review-first');
  strictEqual(grab.channelId, 'moni-review');
});
check('thousands take commas, income takes +, transfers no sign', () => {
  strictEqual(
    buildReviewNotification({ ...grabInput(), amountMinor: 111620 }).title,
    'GRAB*FOOD · −RM1,116.20',
  );
  strictEqual(buildReviewNotification({ ...grabInput(), type: 'income' }).title, 'GRAB*FOOD · +RM23.40');
  strictEqual(buildReviewNotification({ ...grabInput(), type: 'transfer' }).title, 'GRAB*FOOD · RM23.40');
});
check('the accent is Deep mint', () => strictEqual(ACCENT, '#236B47'));

const shown = { proposalId: 'p-grab', merchant: 'GRAB*FOOD', amountMinor: 2340, currency: 'MYR', type: 'expense' };
const approved = buildApprovedNotification({
  ...shown,
  budgetText: 'Food & Dining: RM76 left after this',
  outcome: { action: 'approve' },
});
check('after Approve it reads Approved GRAB*FOOD −RM23.40 over the budget line', () => {
  strictEqual(approved.title, 'Approved GRAB*FOOD −RM23.40');
  strictEqual(approved.body, 'Food & Dining: RM76 left after this');
  strictEqual(approved.identifier, grab.identifier);
  deepStrictEqual(approved.actionIds, ['undo', 'similar']);
});
check('after Don\'t ask about similar it says what Moni does now and keeps Undo', () => {
  const auto = buildAutoAddedNotification({ ...shown, outcome: { action: 'approve' } });
  strictEqual(auto.body, 'Moni adds GRAB*FOOD alerts like this without asking and marks them Auto.');
  deepStrictEqual(auto.actionIds, ['undo']);
});
check('Not mine and Later say what happened, with Undo', () => {
  const notMine = buildSetAsideNotification({ proposalId: 'p-grab', outcome: { action: 'notMine' } });
  strictEqual(notMine.title, '1 not mine');
  strictEqual(notMine.body, 'Nothing was added.');
  deepStrictEqual(notMine.actionIds, ['undo']);
  const later = buildSetAsideNotification({ proposalId: 'p-grab', outcome: { action: 'later' } });
  strictEqual(later.title, 'Saved for later');
  strictEqual(later.body, 'It waits in Review and does not count yet.');
});

const added = (transactionId, merchant, amountMinor, type = 'expense', currency = 'MYR') => ({
  transactionId,
  merchant,
  amountMinor,
  currency,
  type,
});
const oneAdded = addToAutoAddedDigest(null, added('t1', 'GRAB*FOOD', 2340), '2026-10-14');
const digestOfOne = buildAutoAddedDigestNotification({
  digest: oneAdded,
  categoryName: 'Food & Dining',
  budgetText: 'Food & Dining: RM76 left after this',
});
check('the first add of the day reads Added · GRAB*FOOD · −RM23.40 over the budget line', () => {
  strictEqual(digestOfOne.title, 'Added · GRAB*FOOD · −RM23.40');
  strictEqual(digestOfOne.body, 'Food & Dining: RM76 left after this');
  strictEqual(digestOfOne.channelId, 'moni-auto-added');
  deepStrictEqual(digestOfOne.actionIds, ['undo-auto-added']);
  deepStrictEqual(digestOfOne.data, { kind: 'auto-added', transactionId: 't1', count: 1 });
});
check('with no budget it names the category', () =>
  strictEqual(
    buildAutoAddedDigestNotification({ digest: oneAdded, categoryName: 'Food & Dining', budgetText: null }).body,
    'Food & Dining',
  ),
);
const threeAdded = [added('t2', 'KFC', 1580), added('t3', 'JAYA GROCER', 1900)].reduce(
  (digest, item) => addToAutoAddedDigest(digest, item, '2026-10-14'),
  oneAdded,
);
const digestOfThree = buildAutoAddedDigestNotification({
  digest: threeAdded,
  categoryName: 'Groceries',
  budgetText: 'Groceries: RM300 left after this',
});
check('later adds replace it with the day\'s count and total, the latest underneath', () => {
  strictEqual(digestOfThree.title, '3 added automatically today · −RM58.20');
  strictEqual(digestOfThree.body, 'Latest: JAYA GROCER · −RM19.00\nGroceries: RM300 left after this');
  strictEqual(digestOfThree.identifier, digestOfOne.identifier);
  deepStrictEqual(digestOfThree.data, { kind: 'auto-added', transactionId: 't3', count: 3 });
});
check('a transfer shows unsigned and leaves the total out', () => {
  const withReload = addToAutoAddedDigest(
    oneAdded,
    added('t4', "Touch 'n Go reload", 10000, 'transfer'),
    '2026-10-14',
  );
  const digest = buildAutoAddedDigestNotification({ digest: withReload, categoryName: null, budgetText: null });
  strictEqual(digest.title, '2 added automatically today');
  strictEqual(digest.body, "Latest: Touch 'n Go reload · RM100.00");
});
check('the same transaction is counted once, and a new day starts over', () => {
  strictEqual(addToAutoAddedDigest(threeAdded, added('t3', 'JAYA GROCER', 1900), '2026-10-14').items.length, 3);
  deepStrictEqual(
    addToAutoAddedDigest(threeAdded, added('t5', 'GRAB*FOOD', 1200), '2026-10-15').items.map((i) => i.transactionId),
    ['t5'],
  );
});

check('the capture listener skips Moni\'s own notifications', () => {
  strictEqual(isOwnNotification('com.anonymous.moni'), true);
  strictEqual(isOwnNotification('com.anonymous.moni.e2e'), true);
  strictEqual(isOwnNotification('com.maybank2u.life'), false);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
