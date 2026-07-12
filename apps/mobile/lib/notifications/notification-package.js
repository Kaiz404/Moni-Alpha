/** CommonJS mirror for the headless task in index.js (loads before TS). */
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
