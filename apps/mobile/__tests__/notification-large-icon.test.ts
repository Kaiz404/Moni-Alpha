import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import app from '../app.json';
import { copyLargeIcon, setLargeIconMetaData } from '../plugins/with-notification-large-icon';

const APP_ROOT = resolve(__dirname, '..');

describe('notification large icon plugin', () => {
  it('points expo-notifications at the Moni tile drawable', () => {
    const manifest = setLargeIconMetaData({
      manifest: { $: { package: 'com.anonymous.moni' }, application: [{ $: { 'android:name': '.MainApplication' } }] },
    });

    expect(manifest.manifest.application[0]['meta-data']).toEqual([
      {
        $: {
          'android:name': 'expo.modules.notifications.large_notification_icon',
          'android:resource': '@drawable/notification_large_icon',
        },
      },
    ]);
  });

  it('puts the 256 px tile in drawable-xxxhdpi', () => {
    const android = mkdtempSync(join(tmpdir(), 'moni-large-icon-'));

    const written = copyLargeIcon(android);

    expect(written).toBe(join(android, 'app/src/main/res/drawable-xxxhdpi/notification_large_icon.png'));
    expect(readFileSync(written)).toEqual(
      readFileSync(join(APP_ROOT, 'assets/images/notification-large-icon.png')),
    );
  });

  it('runs after expo-notifications in app.json', () => {
    const names = app.expo.plugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));

    expect(names.indexOf('./plugins/with-notification-large-icon')).toBeGreaterThan(
      names.indexOf('expo-notifications'),
    );
  });
});
