// Android re-posts the same notification on updates and regrouping; identical
// bank text within this window is the same event, not a second payment.
const REPEAT_WINDOW_MS = 2 * 60 * 1000;

function notificationKey(n) {
  return [n.packageName ?? n.app ?? '', n.title ?? '', n.text ?? '', n.bigText ?? ''];
}

function isRepeatedNotification(recent, notification, nowMs) {
  const key = notificationKey(notification);
  return recent.some((item) => {
    const ageMs = nowMs - Date.parse(item.receivedAt);
    if (!(ageMs >= 0 && ageMs <= REPEAT_WINDOW_MS)) return false;
    return notificationKey(item).every((part, i) => part === key[i]);
  });
}

module.exports = { isRepeatedNotification, REPEAT_WINDOW_MS };
