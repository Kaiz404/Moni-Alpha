const CAPTURED_NOTIFICATIONS_KEY = 'captured_notifications';

function captureStatusAtIntake({ prefilterPassed, packageLinked, repeated }) {
  if (!prefilterPassed || repeated) return 'ignored';
  if (!packageLinked) return 'not_linked';
  return 'waiting_for_review';
}

function captureStatusAfterExtraction(result) {
  if (result.transactionId) return 'auto_added';
  if (result.proposalId) return 'waiting_for_review';
  return result.skipped ? 'ignored' : 'trying_again';
}

/**
 * The listener hands over each app's icons and any picture as base64, and nothing reads them back.
 * Kept in the log, they made every rewrite megabytes long.
 */
function withoutAlertImages(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  const { icon: _icon, iconLarge: _iconLarge, image: _image, ...rest } = entry;
  return rest;
}

/**
 * `transactionId` links an added entry to its ledger row for "See transaction". A same payment entry
 * links the row counting it: that ledger row, or `pairedProposalId` while it waits in Review.
 */
function setCaptureStatus(storage, id, status, transactionId, pairedProposalId) {
  let list;
  try {
    list = JSON.parse(storage.getString(CAPTURED_NOTIFICATIONS_KEY) || '[]');
  } catch {
    return false;
  }
  if (!Array.isArray(list)) return false;
  list = list.map(withoutAlertImages);
  const entry = list.find((item) => item && item.id === id);
  if (!entry) return false;
  entry.status = status;
  if (transactionId) entry.transactionId = transactionId;
  if (status === 'waiting_for_review') delete entry.transactionId;
  if (pairedProposalId) entry.pairedProposalId = pairedProposalId;
  else delete entry.pairedProposalId;
  storage.set(CAPTURED_NOTIFICATIONS_KEY, JSON.stringify(list));
  return true;
}

module.exports = {
  CAPTURED_NOTIFICATIONS_KEY,
  captureStatusAtIntake,
  captureStatusAfterExtraction,
  setCaptureStatus,
  withoutAlertImages,
};
