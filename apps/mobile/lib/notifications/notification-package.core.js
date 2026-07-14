/**
 * Canonical Android package name for notification routing.
 * react-native-android-notification-listener sets `app` to sbn.getPackageName().
 *
 * CommonJS — required by the headless task in index.js and Node test suites.
 */

function resolveNotificationPackageName(notification) {
  if (notification.packageName && String(notification.packageName).trim()) {
    return String(notification.packageName).trim();
  }
  if (notification.app && String(notification.app).trim()) {
    return String(notification.app).trim();
  }
  return 'unknown';
}

function enrichNotificationPackage(notification) {
  return {
    ...notification,
    packageName: resolveNotificationPackageName(notification),
  };
}

module.exports = {
  resolveNotificationPackageName,
  enrichNotificationPackage,
};
