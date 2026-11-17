// Android redelivers a notification, or re-posts it when it regroups, with the same key and post
// time. Only that is a repeat, and only once the first copy was queued: two payments with the same
// words are two notifications, and a first copy that never reached the queue was not captured.
function sameNotification(a, b) {
  if (a.key && b.key) return a.key === b.key;
  // A capture logged before the listener passed Android's key.
  return (
    (a.packageName ?? a.app ?? '') === (b.packageName ?? b.app ?? '') &&
    (a.title ?? '') === (b.title ?? '') &&
    (a.text ?? '') === (b.text ?? '') &&
    (a.bigText ?? '') === (b.bigText ?? '')
  );
}

function isRepeatedNotification(recent, notification) {
  if (!notification.time) return false;
  return recent.some(
    (item) =>
      item?.queued === true &&
      item.time === notification.time &&
      sameNotification(item, notification),
  );
}

module.exports = { isRepeatedNotification };
