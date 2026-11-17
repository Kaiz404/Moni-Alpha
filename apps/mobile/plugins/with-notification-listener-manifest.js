/**
 * Config plugin that:
 *  1. Lets the app's allowBackup win the AndroidManifest merge over a library's.
 *  2. Adds `android:foregroundServiceType="dataSync"` to the
 *     react-native-background-actions service so it satisfies the Android 14+
 *     (SDK 34+) requirement for typed foreground services.
 *  3. Declares Android 11+ visibility of launchable apps, so a wallet can link any app on the
 *     phone (moni-android-apps). An intent query, because Play restricts QUERY_ALL_PACKAGES.
 *  4. Declares REQUEST_IGNORE_BATTERY_OPTIMIZATIONS for the exemption prompt in
 *     Capture sources.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const BG_ACTIONS_SERVICE = 'com.asterinet.react.bgactions.RNBackgroundActionsTask';

const LAUNCHER_INTENT = {
  action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
  category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
};

function isLauncherQuery(intent) {
  return (
    intent.action?.[0]?.$?.['android:name'] === 'android.intent.action.MAIN' &&
    intent.category?.[0]?.$?.['android:name'] === 'android.intent.category.LAUNCHER'
  );
}

function ensureLauncherVisibility(manifestRoot) {
  manifestRoot.queries = manifestRoot.queries ?? [];
  if (manifestRoot.queries.some((block) => block.intent?.some(isLauncherQuery))) return;
  manifestRoot.queries.push({ intent: [LAUNCHER_INTENT] });
}

module.exports = function withNotificationListenerManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;

    // ── 1. tools namespace + allowBackup fix ──────────────────────────────────
    manifest.manifest.$ = manifest.manifest.$ ?? {};
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    // ── 3. Package visibility for the app picker ─────────────────────────────
    // Without this, PackageManager filters other apps out on API 30+.
    ensureLauncherVisibility(manifest.manifest);

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
      // ── 4. The system prompt that exempts Moni from battery optimization ─────
      // Without the exemption an OEM battery manager can stop the listener silently.
      const BATTERY_EXEMPTION = 'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS';
      for (const name of [FGS_DATA_SYNC, BATTERY_EXEMPTION]) {
        if (!permissions.some((p) => p.$?.['android:name'] === name)) {
          permissions.push({ $: { 'android:name': name } });
        }
      }
    }

    return cfg;
  });
};
