package com.lesimoes.androidnotificationlistener

import android.content.ComponentName
import android.content.Context
import android.provider.Settings
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

  override fun onListenerConnected() {
    connected = true
    rebindRequestedAt = null
    stamp(applicationContext, CONNECTED_AT)
  }

  // Android can unbind a listener while the process lives, on HyperOS after a swipe from recents.
  override fun onListenerDisconnected() {
    connected = false
    stamp(applicationContext, DISCONNECTED_AT)
    rebind(applicationContext)
  }

  companion object {
    private const val STATE = "moni_listener_state"
    private const val CONNECTED_AT = "connectedAt"
    private const val DISCONNECTED_AT = "disconnectedAt"

    /** Bound in this process. A new process starts unbound until Android connects it. */
    @Volatile var connected = false
      private set

    /** The first rebind asked for since the listener was last bound. */
    @Volatile private var rebindRequestedAt: Long? = null

    fun isAccessGranted(context: Context): Boolean {
      val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
      return enabled.orEmpty().split(':').any {
        ComponentName.unflattenFromString(it)?.packageName == context.packageName
      }
    }

    /** Asks Android to bind the listener again when access is on but it is not bound. */
    fun rebind(context: Context): Boolean {
      if (connected || !isAccessGranted(context)) return false
      return try {
        requestRebind(ComponentName(context, RNAndroidNotificationListener::class.java))
        if (rebindRequestedAt == null) rebindRequestedAt = System.currentTimeMillis()
        true
      } catch (e: Exception) {
        Log.w(CaptureHandoff.TAG, "listener rebind refused", e)
        false
      }
    }

    fun state(context: Context): Map<String, Any?> {
      val prefs = context.getSharedPreferences(STATE, Context.MODE_PRIVATE)
      return mapOf(
        "connected" to connected,
        "connectedAt" to prefs.getLong(CONNECTED_AT, 0L).takeIf { it > 0 }?.toDouble(),
        "disconnectedAt" to prefs.getLong(DISCONNECTED_AT, 0L).takeIf { it > 0 }?.toDouble(),
        "rebindRequestedAt" to rebindRequestedAt?.toDouble(),
      )
    }

    private fun stamp(context: Context, key: String) {
      context
        .getSharedPreferences(STATE, Context.MODE_PRIVATE)
        .edit()
        .putLong(key, System.currentTimeMillis())
        .apply()
    }
  }
}
