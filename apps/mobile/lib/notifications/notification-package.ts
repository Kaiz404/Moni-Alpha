/**
 * Canonical Android package name for notification routing.
 * react-native-android-notification-listener sets `app` to sbn.getPackageName().
 */
export function resolveNotificationPackageName(notification: {
  app?: string;
  packageName?: string;
}): string {
  const explicit = notification.packageName?.trim();
  if (explicit) return explicit;
  const app = notification.app?.trim();
  if (app) return app;
  return 'unknown';
}

/** Enrich a raw listener payload with an explicit packageName field. */
export function enrichNotificationPackage<T extends { app?: string; packageName?: string }>(
  notification: T,
): T & { packageName: string } {
  return {
    ...notification,
    packageName: resolveNotificationPackageName(notification),
  };
}
