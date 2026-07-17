import {
  resolveNotificationPackageName as resolveNotificationPackageNameCore,
  enrichNotificationPackage as enrichNotificationPackageCore,
} from './notification-package.core.js';

/** Canonical Android package name for notification routing. */
export function resolveNotificationPackageName(notification: {
  app?: string;
  packageName?: string;
}): string {
  return resolveNotificationPackageNameCore(notification);
}

/** Enrich a raw listener payload with an explicit packageName field. */
export function enrichNotificationPackage<T extends { app?: string; packageName?: string }>(
  notification: T,
): T & { packageName: string } {
  return enrichNotificationPackageCore(notification) as T & {
    packageName: string;
  };
}
