/**
 * Config plugin that resolves the AndroidManifest merger conflict between
 * react-native-android-notification-listener (allowBackup=false) and the
 * app's debug overlay manifest (allowBackup=true).
 *
 * Adds `tools:replace="android:allowBackup"` to the <application> element
 * so the app's value wins at merge time.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withNotificationListenerManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;

    // Ensure the tools namespace is declared on <manifest>
    manifest.manifest.$ = manifest.manifest.$ ?? {};
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    // Add tools:replace to <application> so our allowBackup value wins
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
    }

    return cfg;
  });
};
