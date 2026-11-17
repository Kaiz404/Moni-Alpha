package com.lesimoes.androidnotificationlistener

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

/**
 * The capture listener, in the package and class react-native-android-notification-listener used:
 * Android grants notification access to this exact component, so another name would take the
 * access away on update.
 */
class RNAndroidNotificationListener : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    try {
      val payload = CaptureHandoff.payload(sbn) ?: return
      CaptureHandoff.deliver(applicationContext, payload)
    } catch (e: Exception) {
      Log.e(CaptureHandoff.TAG, "notification not handed to JS", e)
    }
  }
}
