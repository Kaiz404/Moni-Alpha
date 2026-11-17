package com.lesimoes.androidnotificationlistener

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class RNAndroidNotificationListenerHeadlessJsTaskService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val extras = intent?.extras ?: return null
    return HeadlessJsTaskConfig(CaptureHandoff.TASK, Arguments.fromBundle(extras), 15_000, true)
  }
}
