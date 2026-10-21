/**
 * Capture log statuses, stored on each entry of the `captured_notifications` list when the app
 * decides what a notification became. Values come from capturedNotificationStatusSchema in
 * @repo/types.
 *
 * CommonJS — required by the headless task in index.js and by Node suites.
 */
const CAPTURED_NOTIFICATIONS_KEY = 'captured_notifications';

/** Decided on arrival; a queued notification waits until extraction decides. */
function captureStatusAtIntake({ prefilterPassed, packageLinked, repeated }) {
  if (!prefilterPassed || repeated) return 'ignored';
  if (!packageLinked) return 'not_linked';
  return 'waiting_for_review';
}

/** After extraction: added straight to the ledger, sent to review, or dropped. */
function captureStatusAfterExtraction(result) {
  if (result.transactionId) return 'auto_added';
  if (result.proposalId) return 'waiting_for_review';
  return 'ignored';
}

/** `storage` is the `moni-notifications` MMKV. Returns false when the entry has aged out. */
function setCaptureStatus(storage, id, status) {
  let list;
  try {
    list = JSON.parse(storage.getString(CAPTURED_NOTIFICATIONS_KEY) || '[]');
  } catch {
    return false;
  }
  const entry = Array.isArray(list) ? list.find((item) => item && item.id === id) : undefined;
  if (!entry) return false;
  entry.status = status;
  storage.set(CAPTURED_NOTIFICATIONS_KEY, JSON.stringify(list));
  return true;
}

module.exports = {
  CAPTURED_NOTIFICATIONS_KEY,
  captureStatusAtIntake,
  captureStatusAfterExtraction,
  setCaptureStatus,
};
