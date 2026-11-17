import { AppRegistry, Platform } from 'react-native';

if (process.env.EXPO_PUBLIC_E2E_NOW) {
  require('./lib/e2e/pinned-clock.core').pinClock(process.env.EXPO_PUBLIC_E2E_NOW);
}

if (Platform.OS === 'android') {
  const {
    RNAndroidNotificationListenerHeadlessJsName,
  } = require('react-native-android-notification-listener');

  const ALL_NOTIFICATIONS_KEY = 'captured_notifications';
  const MAX_STORED = 50;

  // A log that cannot be read starts over, rather than failing every capture that follows.
  function readList(storage, key) {
    const existing = storage.getString(key);
    if (!existing) return [];
    try {
      const list = JSON.parse(existing);
      if (Array.isArray(list)) return list;
    } catch {}
    console.error('[NotifCapture] capture log unreadable, starting a new one');
    return [];
  }

  function appendToList(storage, key, item, max) {
    const list = readList(storage, key);
    list.unshift(item);
    storage.set(key, JSON.stringify(list.slice(0, max)));
  }

  // Everything loads here, when a notification arrives, so registering the task never waits on the
  // app's modules and a throw while they load reaches the catch below instead of the registration.
  const headlessNotificationListener = async ({ notification }) => {
    if (!notification) {
      console.log('[NotifCapture] empty payload — listener fired but no data');
      return;
    }

    try {
      const { createMMKV } = require('react-native-mmkv');
      const {
        passesNotificationTransactionPrefilter,
        withoutOneTimeCode,
      } = require('./lib/notifications/notification-filter.core');
      const { randomUUID } = require('expo-crypto');
      const {
        isPackageLinked,
        isLocationRecordedForPackage,
      } = require('./lib/notifications/linked-packages-cache.core');
      const { captureStatusAtIntake } = require('./lib/notifications/capture-status.core');
      const { recordHeard } = require('./lib/notifications/capture-health.core');
      const { enrichNotificationPackage } = require('./lib/notifications/notification-package.core');
      const { isRepeatedNotification } = require('./lib/notifications/notification-repeat.core');
      const { isOwnNotification } = require('./lib/notifications/review-notification.core');

      const notificationStorage = createMMKV({ id: 'moni-notifications' });
      const parsed = typeof notification === 'string' ? JSON.parse(notification) : notification;
      // Images stay out of the log and the queue, which every capture rewrites in full.
      const { icon: _icon, iconLarge: _iconLarge, image: _image, ...text } = parsed;
      const withPackage = withoutOneTimeCode(enrichNotificationPackage(text));
      if (isOwnNotification(withPackage.packageName)) return;
      const prefilterPassed = passesNotificationTransactionPrefilter(withPackage);
      const packageLinked = isPackageLinked(withPackage.packageName);
      const nowMs = Date.now();
      const repeated = isRepeatedNotification(
        readList(notificationStorage, ALL_NOTIFICATIONS_KEY),
        withPackage,
        nowMs,
      );
      const enriched = {
        ...withPackage,
        // A UUID, because the proposal or transaction it becomes takes this id into Postgres.
        id: randomUUID(),
        receivedAt: new Date(nowMs).toISOString(),
        prefilterPassed,
        packageLinked,
        repeated,
        status: captureStatusAtIntake({ prefilterPassed, packageLinked, repeated }),
      };

      const queueEligible = prefilterPassed && packageLinked && !repeated;
      // Queued before anything slow, so a process Android stops early still keeps the capture.
      if (queueEligible) {
        require('./lib/ai/processing-queue').enqueue({
          id: enriched.id,
          type: 'notification',
          notification: enriched,
          createdAt: enriched.receivedAt,
          status: 'pending',
          locationSnapshot: null,
        });
      }

      appendToList(notificationStorage, ALL_NOTIFICATIONS_KEY, enriched, MAX_STORED);
      recordHeard(notificationStorage, {
        packageName: enriched.packageName,
        linked: packageLinked,
        at: enriched.receivedAt,
      });
      console.log(
        '[NotifCapture] stored',
        enriched.packageName ?? enriched.app ?? 'unknown',
        queueEligible
          ? 'queued'
          : !prefilterPassed
            ? 'ignored'
            : !packageLinked
              ? 'unlinked'
              : 'repeat',
      );

      if (queueEligible) {
        try {
          if (isLocationRecordedForPackage(enriched.packageName)) {
            const { captureHeadlessLocationSnapshot } = require('./lib/location/location-snapshot');
            const locationSnapshot = await captureHeadlessLocationSnapshot();
            if (locationSnapshot) {
              require('./lib/ai/processing-queue').attachLocation(enriched.id, locationSnapshot);
            }
          }
        } catch (e) {
          console.error('[NotifCapture] location skipped:', e?.message ?? e);
        }

        const { startBackgroundProcessor } = require('./lib/ai/background-processor');
        // Kick off processing immediately from headless context so notification
        // extraction runs even when the app UI is not open. A new capture is also
        // a moment to retry the ones still waiting.
        await startBackgroundProcessor().catch((e) => {
          console.error('[NotifCapture] processor start failed:', e?.message ?? e);
        });
      }
    } catch (e) {
      console.error('[NotifCapture] failed to handle notification:', e?.message ?? e);
    }
  };

  AppRegistry.registerHeadlessTask(
    RNAndroidNotificationListenerHeadlessJsName,
    () => headlessNotificationListener,
  );

  // Not mine, Later and Approve on Moni's review notification, with the app in the background
  // or killed. The handler loads the store and review-actions only when a tap arrives.
  try {
    const TaskManager = require('expo-task-manager');
    const Notifications = require('expo-notifications');
    const { REVIEW_TASK } = require('./lib/notifications/review-notification.core');
    TaskManager.defineTask(REVIEW_TASK, (body) =>
      require('./lib/notifications/review-notification').handleReviewNotificationTask(body),
    );
    Notifications.registerTaskAsync(REVIEW_TASK).catch((e) => {
      console.error('[ReviewNotif] task not registered:', e?.message ?? e);
    });
  } catch (e) {
    console.error('[ReviewNotif] task not registered:', e?.message ?? e);
  }
}

// A require, not an import: imports are hoisted above the registration, and the router loads the
// whole app.
require('expo-router/entry');
