/**
 * Shows Moni's full-colour tile beside the text of every notification Moni posts through
 * expo-notifications (review, auto-added, bill reminders). expo-notifications reads a local
 * notification's large icon from this application meta-data, but its own plugin has no option
 * for it, so this one adds the drawable and the meta-data.
 */
const fs = require('node:fs');
const path = require('node:path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const { addMetaDataItemToMainApplication, getMainApplicationOrThrow } = AndroidConfig.Manifest;

const LARGE_ICON_META_DATA = 'expo.modules.notifications.large_notification_icon';
const LARGE_ICON_RESOURCE = '@drawable/notification_large_icon';
const SOURCE = path.join(__dirname, '../assets/images/notification-large-icon.png');
// The tile is 256 px, 64 dp at 4x; Android scales it down for the other densities.
const TARGET = 'app/src/main/res/drawable-xxxhdpi/notification_large_icon.png';

function setLargeIconMetaData(manifest) {
  addMetaDataItemToMainApplication(
    getMainApplicationOrThrow(manifest),
    LARGE_ICON_META_DATA,
    LARGE_ICON_RESOURCE,
    'resource',
  );
  return manifest;
}

function copyLargeIcon(androidRoot) {
  const target = path.join(androidRoot, TARGET);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(SOURCE, target);
  return target;
}

function withNotificationLargeIcon(config) {
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      copyLargeIcon(cfg.modRequest.platformProjectRoot);
      return cfg;
    },
  ]);
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults = setLargeIconMetaData(cfg.modResults);
    return cfg;
  });
}

module.exports = withNotificationLargeIcon;
module.exports.setLargeIconMetaData = setLargeIconMetaData;
module.exports.copyLargeIcon = copyLargeIcon;
