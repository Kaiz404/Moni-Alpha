import { AppRegistry, Platform } from 'react-native';

if (Platform.OS === 'android') {
  const {
    default: RNAndroidNotificationListener,
    RNAndroidNotificationListenerHeadlessJsName,
  } = require('react-native-android-notification-listener');
  const { createMMKV } = require('react-native-mmkv');

  void RNAndroidNotificationListener;

  const notificationStorage = createMMKV({ id: 'moni-notifications' });

  const ALL_NOTIFICATIONS_KEY = 'captured_notifications';
  const PENDING_AI_KEY = 'pending_ai_queue';
  const MAX_STORED = 100;

  /**
   * Detects money amounts across common currency formats:
   *   $1,234.56  €50  £9.99  ₦5,000  ₹200  ¥1000
   *   50 USD  1,234.56 NGN  R500  ZAR 200
   */
  const MONEY_PATTERN =
    /(?:[$€£¥₦₹₩₪₱฿₫₲₴₵₸₽₾R])\s*[\d,]+(?:[.,]\d{1,2})?|[\d,]+(?:[.,]\d{1,2})?\s*(?:USD|EUR|GBP|NGN|ZAR|KES|GHS|UGX|TZS|MYR|SGD|AUD|CAD|CHF|JPY|CNY|INR|BRL|MXN|AED|SAR|QAR|KWD|OMR|BHD)\b/i;

  function containsMoney(notification) {
    const haystack = [
      notification.title,
      notification.titleBig,
      notification.text,
      notification.bigText,
      notification.subText,
      notification.summaryText,
      notification.extraInfoText,
    ]
      .filter(Boolean)
      .join(' ');
    return MONEY_PATTERN.test(haystack);
  }

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

      // If it looks like a monetary notification, queue for AI analysis
      if (containsMoney(parsed)) {
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
