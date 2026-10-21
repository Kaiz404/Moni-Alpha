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
