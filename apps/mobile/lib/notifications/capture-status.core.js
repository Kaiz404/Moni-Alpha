const CAPTURED_NOTIFICATIONS_KEY = 'captured_notifications';

function captureStatusAtIntake({ prefilterPassed, packageLinked, repeated }) {
  if (!prefilterPassed || repeated) return 'ignored';
  if (!packageLinked) return 'not_linked';
  return 'waiting_for_review';
}

function captureStatusAfterExtraction(result) {
  if (result.transactionId) return 'auto_added';
  if (result.proposalId) return 'waiting_for_review';
  return 'ignored';
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
  const entry = Array.isArray(list) ? list.find((item) => item && item.id === id) : undefined;
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
};
