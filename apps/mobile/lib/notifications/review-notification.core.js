/**
 * The Android review notification (`XA-Notification`): payloads only, no library calls.
 * index.js, scripts/notification-review-suite.mjs and review-notification.ts share it.
 */

const REVIEW_TASK = 'moni-review-notification-action';
const REVIEW_CATEGORY = 'moni-review';
const APPROVED_CATEGORY = 'moni-review-approved';
/** Not mine, Later, and Approve after Don't ask about similar: only Undo is left. */
const DECIDED_CATEGORY = 'moni-review-decided';
/** The first alert after install pops up as heads-up; later ones arrive quietly in the shade. */
const HEADS_UP_CHANNEL = 'moni-review-first';
const QUIET_CHANNEL = 'moni-review';
/** How long a decision stays up with Undo before the notification clears. */
const APPROVED_MS = 8000;
/** `XA-Notification` accent, Deep mint: Android tints the small icon and the actions with it. */
const ACCENT = '#236B47';

/** Same order as the Review card: Approve on the right. */
const REVIEW_ACTIONS = [
  { id: 'not-mine', title: 'Not mine' },
  { id: 'later', title: 'Later' },
  { id: 'approve', title: 'Approve' },
];
const APPROVED_ACTIONS = [
  { id: 'undo', title: 'Undo' },
  { id: 'similar', title: "Don't ask about similar" },
];
const DECIDED_ACTIONS = [{ id: 'undo', title: 'Undo' }];

const OWN_PACKAGES = new Set(['com.anonymous.moni', 'com.anonymous.moni.e2e']);
const MINUS = '−';

/** Moni's own notifications are not bank alerts; the capture listener skips them. */
function isOwnNotification(packageName) {
  return OWN_PACKAGES.has(packageName);
}

/**
 * Glossary money: expenses `−RM12.00` (U+2212), income `+RM12.00`, transfers unsigned,
 * thousands commas, other currencies by their code.
 */
function formatAmount(amountMinor, currency, type) {
  const code = String(currency || 'MYR').toUpperCase();
  const symbol = code === 'MYR' ? 'RM' : `${code} `;
  const digits = (Math.abs(Number(amountMinor)) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = type === 'income' ? '+' : type === 'transfer' ? '' : MINUS;
  return `${sign}${symbol}${digits}`;
}

function identifierFor(proposalId) {
  return `review-${proposalId}`;
}

/** "Moni: Food & Dining, like the last 14 times." from how often this merchant was filed there. */
function moniLine(categoryName, seenCount) {
  if (!categoryName) return null;
  const like =
    seenCount > 1 ? `, like the last ${seenCount} times` : seenCount === 1 ? ', like last time' : '';
  return `Moni: ${categoryName}${like}.`;
}

/**
 * `XA-Notification` 1: "Moni · Maybank · now" over "GRAB*FOOD · −RM23.40", the alert as the bank
 * sent it, Moni's category, and Not mine, Later, Approve. `firstAlert` picks the heads-up channel.
 */
function buildReviewNotification({
  proposalId,
  bankName,
  merchant,
  amountMinor,
  currency,
  type,
  alertText,
  categoryName,
  seenCount,
  firstAlert,
}) {
  return {
    identifier: identifierFor(proposalId),
    channelId: firstAlert ? HEADS_UP_CHANNEL : QUIET_CHANNEL,
    title: `${merchant} · ${formatAmount(amountMinor, currency, type)}`,
    subtitle: bankName || null,
    body: [alertText, moniLine(categoryName, seenCount)].filter(Boolean).join('\n'),
    categoryIdentifier: REVIEW_CATEGORY,
    actionIds: REVIEW_ACTIONS.map((action) => action.id),
    data: { kind: 'review', proposalId },
  };
}

function decided({ proposalId, title, body, categoryIdentifier, actions, outcome }) {
  return {
    identifier: identifierFor(proposalId),
    channelId: QUIET_CHANNEL,
    title,
    subtitle: null,
    body: body || '',
    categoryIdentifier,
    actionIds: actions.map((action) => action.id),
    data: { kind: 'decided', proposalId, outcome },
  };
}

/** After Approve: "Approved GRAB*FOOD −RM23.40", the budget line, Undo and Don't ask about similar. */
function buildApprovedNotification({
  proposalId,
  merchant,
  amountMinor,
  currency,
  type,
  budgetText,
  outcome,
}) {
  return decided({
    proposalId,
    title: `Approved ${merchant} ${formatAmount(amountMinor, currency, type)}`,
    body: budgetText,
    categoryIdentifier: APPROVED_CATEGORY,
    actions: APPROVED_ACTIONS,
    outcome,
  });
}

/** After Don't ask about similar: the same title, what Moni does from now on, and Undo. */
function buildAutoAddedNotification({ proposalId, merchant, amountMinor, currency, type, outcome }) {
  return decided({
    proposalId,
    title: `Approved ${merchant} ${formatAmount(amountMinor, currency, type)}`,
    body: `Moni adds ${merchant} alerts like this without asking and marks them Auto.`,
    categoryIdentifier: DECIDED_CATEGORY,
    actions: DECIDED_ACTIONS,
    outcome,
  });
}

/** After Not mine or Later: "1 not mine" or "Saved for later", what that means, and Undo. */
function buildSetAsideNotification({ proposalId, outcome }) {
  const notMine = outcome.action === 'notMine';
  return decided({
    proposalId,
    title: notMine ? '1 not mine' : 'Saved for later',
    body: notMine ? 'Nothing was added.' : 'It waits in Review and does not count yet.',
    categoryIdentifier: DECIDED_CATEGORY,
    actions: DECIDED_ACTIONS,
    outcome,
  });
}

/** Shown when Approve cannot finish without the app, such as a capture with no wallet. */
function buildOpenAppNotification({ proposalId, merchant, amountMinor, currency, type, reason }) {
  return {
    identifier: identifierFor(proposalId),
    channelId: QUIET_CHANNEL,
    title: reason,
    subtitle: null,
    body: `${merchant} · ${formatAmount(amountMinor, currency, type)}`,
    categoryIdentifier: null,
    actionIds: [],
    data: { kind: 'review', proposalId },
  };
}

module.exports = {
  REVIEW_TASK,
  REVIEW_CATEGORY,
  APPROVED_CATEGORY,
  DECIDED_CATEGORY,
  HEADS_UP_CHANNEL,
  QUIET_CHANNEL,
  APPROVED_MS,
  ACCENT,
  REVIEW_ACTIONS,
  APPROVED_ACTIONS,
  DECIDED_ACTIONS,
  isOwnNotification,
  formatAmount,
  identifierFor,
  buildReviewNotification,
  buildApprovedNotification,
  buildAutoAddedNotification,
  buildSetAsideNotification,
  buildOpenAppNotification,
};
