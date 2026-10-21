/**
 * The Android review notification (`XA-Notification`): payloads only, no library calls.
 * index.js, scripts/notification-review-suite.mjs and review-notification.ts share it.
 */

const REVIEW_TASK = 'moni-review-notification-action';
const REVIEW_CATEGORY = 'moni-review';
const APPROVED_CATEGORY = 'moni-review-approved';
/** The first alert after install pops up as heads-up; later ones arrive quietly in the shade. */
const HEADS_UP_CHANNEL = 'moni-review-first';
const QUIET_CHANNEL = 'moni-review';
/** How long "Approved" with Undo stays before the notification clears. */
const APPROVED_MS = 8000;

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

const OWN_PACKAGES = new Set(['com.anonymous.moni', 'com.anonymous.moni.e2e']);

/** Moni's own notifications are not bank alerts; the capture listener skips them. */
function isOwnNotification(packageName) {
  return OWN_PACKAGES.has(packageName);
}

/** Glossary money with no sign: `RM12.00`, `RM1,116.20`, other currencies by their code. */
function formatAmount(amountMinor, currency) {
  const code = String(currency || 'MYR').toUpperCase();
  const symbol = code === 'MYR' ? 'RM' : `${code} `;
  const digits = (Math.abs(Number(amountMinor)) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${digits}`;
}

function identifierFor(proposalId) {
  return `review-${proposalId}`;
}

/**
 * The notification for one capture waiting for review: "Maybank alert", "GRAB · RM12.00",
 * and Not mine, Later, Approve. `firstAlert` picks the heads-up channel.
 */
function buildReviewNotification({
  proposalId,
  sourceLabel,
  merchant,
  amountMinor,
  currency,
  categoryName,
  firstAlert,
}) {
  return {
    identifier: identifierFor(proposalId),
    channelId: firstAlert ? HEADS_UP_CHANNEL : QUIET_CHANNEL,
    title: sourceLabel,
    subtitle: categoryName || null,
    body: `${merchant} · ${formatAmount(amountMinor, currency)}`,
    categoryIdentifier: REVIEW_CATEGORY,
    actionIds: REVIEW_ACTIONS.map((action) => action.id),
    data: { kind: 'review', proposalId },
  };
}

/** After Approve: "Approved" with Undo and Don't ask about similar, for APPROVED_MS. */
function buildApprovedNotification({ proposalId, merchant, amountMinor, currency, outcome }) {
  return {
    identifier: identifierFor(proposalId),
    channelId: QUIET_CHANNEL,
    title: 'Approved',
    subtitle: null,
    body: `${merchant} · ${formatAmount(amountMinor, currency)}`,
    categoryIdentifier: APPROVED_CATEGORY,
    actionIds: APPROVED_ACTIONS.map((action) => action.id),
    data: { kind: 'approved', proposalId, outcome },
  };
}

/** Shown when Approve cannot finish without the app, such as a capture with no wallet. */
function buildOpenAppNotification({ proposalId, merchant, amountMinor, currency, reason }) {
  return {
    identifier: identifierFor(proposalId),
    channelId: QUIET_CHANNEL,
    title: reason,
    subtitle: null,
    body: `${merchant} · ${formatAmount(amountMinor, currency)}`,
    categoryIdentifier: null,
    actionIds: [],
    data: { kind: 'review', proposalId },
  };
}

module.exports = {
  REVIEW_TASK,
  REVIEW_CATEGORY,
  APPROVED_CATEGORY,
  HEADS_UP_CHANNEL,
  QUIET_CHANNEL,
  APPROVED_MS,
  REVIEW_ACTIONS,
  APPROVED_ACTIONS,
  isOwnNotification,
  formatAmount,
  identifierFor,
  buildReviewNotification,
  buildApprovedNotification,
  buildOpenAppNotification,
};
