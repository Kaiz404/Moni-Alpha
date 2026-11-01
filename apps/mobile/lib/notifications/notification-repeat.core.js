// Android re-posts the same notification on updates and regrouping; identical
// bank text within this window, or with the same post time at any age, is the
// same event, not a second payment.
const REPEAT_WINDOW_MS = 2 * 60 * 1000;

function notificationKey(n) {
  return [n.packageName ?? n.app ?? '', n.title ?? '', n.text ?? '', n.bigText ?? ''];
}

function isRepeatedNotification(recent, notification, nowMs) {
  const key = notificationKey(notification);
  return recent.some((item) => {
    if (!notificationKey(item).every((part, i) => part === key[i])) return false;
    if (notification.time && item.time === notification.time) return true;
    const ageMs = nowMs - Date.parse(item.receivedAt);
    return ageMs >= 0 && ageMs <= REPEAT_WINDOW_MS;
  });
}

module.exports = { isRepeatedNotification, REPEAT_WINDOW_MS };
