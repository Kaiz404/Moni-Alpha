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

  void RNAndroidNotificationListener;

  const notificationStorage = createMMKV({ id: 'moni-notifications' });

  const ALL_NOTIFICATIONS_KEY = 'captured_notifications';
  const PENDING_AI_KEY = 'pending_ai_queue';
  const MAX_STORED = 100;

  function appendToList(key, item, max) {
    const existing = notificationStorage.getString(key);
    const list = existing ? JSON.parse(existing) : [];
    list.unshift(item);
    notificationStorage.set(key, JSON.stringify(list.slice(0, max)));
  }

  const headlessNotificationListener = async ({ notification }) => {
    if (!notification) return;

    try {
      const parsed = JSON.parse(notification);
      const enriched = {
        ...parsed,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        receivedAt: new Date().toISOString(),
      };

      // Always store in the full notifications list
      appendToList(ALL_NOTIFICATIONS_KEY, enriched, MAX_STORED);

      // Queue only likely real bank/wallet transaction notifications for AI analysis
      if (passesNotificationTransactionPrefilter(parsed)) {
        appendToList(PENDING_AI_KEY, enriched, MAX_STORED);
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
