import { AppRegistry, Platform } from 'react-native';

if (Platform.OS === 'android') {
  const {
    default: RNAndroidNotificationListener,
    RNAndroidNotificationListenerHeadlessJsName,
  } = require('react-native-android-notification-listener');
  const { createMMKV } = require('react-native-mmkv');
  const {
    passesNotificationTransactionPrefilter,
  } = require('./scripts/notification-filter');
  const { startBackgroundProcessor } = require('./lib/ai/background-processor');
  const { captureLocationSnapshot } = require('./lib/location/location-snapshot');

  void RNAndroidNotificationListener;

  const notificationStorage = createMMKV({ id: 'moni-notifications' });
  const processingStorage = createMMKV({ id: 'moni-processing' });

  const ALL_NOTIFICATIONS_KEY = 'captured_notifications';
  const UNIFIED_QUEUE_KEY = 'unified_processing_queue';
  const MAX_STORED = 50;

  function appendToList(storage, key, item, max) {
    const existing = storage.getString(key);
    const list = existing ? JSON.parse(existing) : [];
    list.unshift(item);
    storage.set(key, JSON.stringify(list.slice(0, max)));
  }

  const headlessNotificationListener = async ({ notification }) => {
    if (!notification) return;

    try {
      const parsed = JSON.parse(notification);
      const prefilterPassed = passesNotificationTransactionPrefilter(parsed);
      const enriched = {
        ...parsed,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        receivedAt: new Date().toISOString(),
        prefilterPassed,
      };

      // Always store in the full notifications list for the UI
      appendToList(notificationStorage, ALL_NOTIFICATIONS_KEY, enriched, MAX_STORED);

      // Queue notifications that pass the prefilter into the unified processing queue
      if (prefilterPassed) {
        const locationSnapshot = await captureLocationSnapshot();
        const queueItem = {
          id: enriched.id,
          type: 'notification',
          notification: enriched,
          createdAt: enriched.receivedAt,
          status: 'pending',
          locationSnapshot,
        };
        appendToList(processingStorage, UNIFIED_QUEUE_KEY, queueItem, MAX_STORED);

        // Kick off processing immediately from headless context so notification
        // orchestration runs even when the app UI is not open.
        await startBackgroundProcessor().catch(() => {});
      }
    } catch {
      // Malformed notification payload — silently ignore
    }
  };

  AppRegistry.registerHeadlessTask(
    RNAndroidNotificationListenerHeadlessJsName,
    () => headlessNotificationListener,
  );
}

import 'expo-router/entry';
