package com.lesimoes.androidnotificationlistener

import android.app.Notification
import android.content.Context
import android.content.Intent
import android.service.notification.StatusBarNotification
import android.util.Log
import com.facebook.react.HeadlessJsTaskService
import org.json.JSONArray
import org.json.JSONObject

/**
 * Hands each notification to the JS capture task as text only. Every app's notifications pass
 * through here, so icons and pictures would only make the Binder hand-off big enough to fail.
 */
object CaptureHandoff {
  const val TAG = "MoniCapture"
  /** The task name index.js registers. */
  const val TASK = "RNAndroidNotificationListenerHeadlessJs"

  private const val INBOX = "moni_capture_inbox"
  private const val INBOX_KEY = "pending"
  private const val MAX_INBOX = 50
  private const val MAX_FIELD = 4_000
  private const val MAX_LINES = 20

  private val TEXT_FIELDS =
    listOf(
      "title" to Notification.EXTRA_TITLE,
      "titleBig" to Notification.EXTRA_TITLE_BIG,
      "text" to Notification.EXTRA_TEXT,
      "subText" to Notification.EXTRA_SUB_TEXT,
      "summaryText" to Notification.EXTRA_SUMMARY_TEXT,
      "bigText" to Notification.EXTRA_BIG_TEXT,
      "extraInfoText" to Notification.EXTRA_INFO_TEXT,
    )

  fun payload(sbn: StatusBarNotification): String? {
    val extras = sbn.notification?.extras ?: return null
    val json = JSONObject()
    json.put("app", sbn.packageName ?: "Unknown App")
    json.put("time", sbn.postTime.toString())
    json.put("key", sbn.key)
    for ((name, extra) in TEXT_FIELDS) {
      json.put(name, extras.getCharSequence(extra)?.toString()?.trim()?.take(MAX_FIELD) ?: "")
    }
    val lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
    json.put("groupedMessages", groupedMessages(json.getString("title"), lines))
    return json.toString()
  }

  /** The library's split: a line's text after its first colon, and what precedes it as the title. */
  private fun groupedMessages(title: String, lines: Array<CharSequence>?): JSONArray {
    val result = JSONArray()
    for (line in lines.orEmpty().take(MAX_LINES)) {
      val message = line?.toString()?.trim()?.take(MAX_FIELD)
      if (message.isNullOrEmpty()) continue
      val colon = message.indexOf(':')
      val entry = JSONObject()
      if (colon == -1) {
        entry.put("title", title)
        entry.put("text", message)
      } else {
        entry.put("title", message.substring(0, colon).trim())
        entry.put("text", message.substring(colon + 1).trim())
      }
      result.put(entry)
    }
    return result
  }

  /** Starts the JS task. A start Android refuses keeps the payload for the next run to drain. */
  fun deliver(context: Context, payload: String) {
    try {
      val intent =
        Intent(context, RNAndroidNotificationListenerHeadlessJsTaskService::class.java)
          .putExtra("notification", payload)
      HeadlessJsTaskService.acquireWakeLockNow(context)
      context.startService(intent)
    } catch (e: Exception) {
      Log.w(TAG, "capture task not started, kept for the next run", e)
      keep(context, payload)
    }
  }

  @Synchronized
  private fun keep(context: Context, payload: String) {
    val inbox = read(context)
    inbox.put(payload)
    val kept = JSONArray()
    for (i in maxOf(0, inbox.length() - MAX_INBOX) until inbox.length()) kept.put(inbox.get(i))
    prefs(context).edit().putString(INBOX_KEY, kept.toString()).commit()
  }

  /** Every payload a refused start kept, oldest first, and the inbox is empty after. */
  @Synchronized
  fun drain(context: Context): List<String> {
    val inbox = read(context)
    if (inbox.length() == 0) return emptyList()
    prefs(context).edit().remove(INBOX_KEY).commit()
    return (0 until inbox.length()).map { inbox.getString(it) }
  }

  private fun read(context: Context): JSONArray =
    try {
      JSONArray(prefs(context).getString(INBOX_KEY, null) ?: "[]")
    } catch (e: Exception) {
      JSONArray()
    }

  private fun prefs(context: Context) = context.getSharedPreferences(INBOX, Context.MODE_PRIVATE)
}
