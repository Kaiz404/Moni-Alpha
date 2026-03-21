/**
 * Config plugin that:
 *  1. Resolves the AndroidManifest merger conflict between
 *     react-native-android-notification-listener (allowBackup=false) and the
 *     app's debug overlay manifest (allowBackup=true).
 *  2. Adds `android:foregroundServiceType="dataSync"` to the
 *     react-native-background-actions service so it satisfies the Android 14+
 *     (SDK 34+) requirement for typed foreground services.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const BG_ACTIONS_SERVICE = 'com.asterinet.react.bgactions.RNBackgroundActionsTask';

module.exports = function withNotificationListenerManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;

    // ── 1. tools namespace + allowBackup fix ──────────────────────────────────
    manifest.manifest.$ = manifest.manifest.$ ?? {};
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const application = manifest.manifest.application?.[0];
    if (application) {
      application.$ = application.$ ?? {};
      const existing = application.$['tools:replace'];
      if (existing) {
        if (!existing.split(',').map((s) => s.trim()).includes('android:allowBackup')) {
          application.$['tools:replace'] = `${existing}, android:allowBackup`;
        }
      } else {
        application.$['tools:replace'] = 'android:allowBackup';
      }

      // ── 2. Add foregroundServiceType to RNBackgroundActionsTask ─────────────
      // Android 14+ (targetSdk >= 34) requires every foreground service to
      // declare a type. Without it the OS throws
      // MissingForegroundServiceTypeException and crashes the app.
      application.service = application.service ?? [];
      const existing_service = application.service.find(
        (s) => s.$?.['android:name'] === BG_ACTIONS_SERVICE,
      );
      if (existing_service) {
        // Patch existing entry
        existing_service.$ = existing_service.$ ?? {};
        existing_service.$['android:foregroundServiceType'] = 'dataSync';
      } else {
        // Insert a new <service> entry that the aar's own manifest will merge with
        application.service.push({
          $: {
            'android:name': BG_ACTIONS_SERVICE,
            'android:foregroundServiceType': 'dataSync',
            'tools:node': 'merge',
          },
        });
      }

      // The FOREGROUND_SERVICE_DATA_SYNC permission is also required on SDK 34+
      manifest.manifest['uses-permission'] = manifest.manifest['uses-permission'] ?? [];
      const permissions = manifest.manifest['uses-permission'];
      const FGS_DATA_SYNC = 'android.permission.FOREGROUND_SERVICE_DATA_SYNC';
      if (!permissions.some((p) => p.$?.['android:name'] === FGS_DATA_SYNC)) {
        permissions.push({ $: { 'android:name': FGS_DATA_SYNC } });
      }
    }

    return cfg;
  });
};
