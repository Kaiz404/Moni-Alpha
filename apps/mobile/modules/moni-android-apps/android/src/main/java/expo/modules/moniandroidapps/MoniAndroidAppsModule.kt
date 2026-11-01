package expo.modules.moniandroidapps

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.view.WindowManager
import android.util.Base64
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.Queues
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream

class MoniAndroidAppsModule : Module() {
  private val reactContext
    get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {
    Name("MoniAndroidApps")

    AsyncFunction("getInstalledAppsAsync") { packageNames: List<String> ->
      getInstalledApps(packageNames)
    }

    AsyncFunction("getAppInfoAsync") { packageName: String ->
      getAppInfo(packageName.trim())
    }

    // Pan moves the whole window, header included, so a page that lifts its own composer turns it off.
    AsyncFunction("setKeyboardPansWindowAsync") { pans: Boolean ->
      appContext.currentActivity?.window?.setSoftInputMode(
        if (pans) WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN
        else WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE,
      )
      Unit
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("isIgnoringBatteryOptimizationsAsync") {
      val power = reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager
      power.isIgnoringBatteryOptimizations(reactContext.packageName)
    }

    AsyncFunction("requestBatteryExemptionAsync") {
      open(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, packageUri())) ||
        open(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }

    AsyncFunction("openBatterySettingsAsync") {
      open(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }

    // MIUI and HyperOS keep Autostart in their own security app, with no public API to read it.
    // A version can rename the page or refuse outside callers, so the caller is told what opened.
    AsyncFunction("openAutostartSettingsAsync") {
      val autostart =
        Intent().setClassName(
          "com.miui.securitycenter",
          "com.miui.permcenter.autostart.AutoStartManagementActivity",
        )
      when {
        open(autostart) -> "autostart"
        open(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri())) -> "app_details"
        else -> "none"
      }
    }
  }

  private fun packageUri(): Uri = Uri.parse("package:${reactContext.packageName}")

  private fun open(intent: Intent): Boolean {
    return try {
      reactContext.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      true
    } catch (error: Exception) {
      Log.w(TAG, "Could not open ${intent.action ?: intent.component}", error)
      false
    }
  }

  /**
   * Only return the package IDs the picker can display. A launcher-wide scan
   * produces hundreds of base64 icon payloads and can stall the JS/UI thread.
   */
  private fun getInstalledApps(packageNames: List<String>): List<Map<String, Any?>> {
    val apps = packageNames
      .asSequence()
      .map { it.trim() }
      .filter { it.isNotEmpty() }
      .distinct()
      .mapNotNull { getAppInfo(it) }
      .sortedBy { (it["label"] as String).lowercase() }
      .toList()

    Log.d(TAG, "Returning ${apps.size} requested installed apps")
    return apps
  }

  private fun getAppInfo(packageName: String): Map<String, Any?>? {
    if (packageName.isEmpty()) return null
    return try {
      val pm = reactContext.packageManager
      val appInfo =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          pm.getApplicationInfo(packageName, PackageManager.ApplicationInfoFlags.of(0))
        } else {
          @Suppress("DEPRECATION")
          pm.getApplicationInfo(packageName, 0)
        }
      val label = pm.getApplicationLabel(appInfo).toString().trim()
      mapOf(
        "packageName" to packageName,
        "label" to label,
        "iconUri" to drawableToDataUri(pm.getApplicationIcon(appInfo)),
      )
    } catch (_: PackageManager.NameNotFoundException) {
      null
    } catch (error: Exception) {
      Log.w(TAG, "getAppInfo failed for $packageName", error)
      null
    }
  }

  private fun drawableToDataUri(drawable: Drawable): String? {
    return try {
      val source =
        when (drawable) {
          is BitmapDrawable -> {
            val bmp = drawable.bitmap ?: return null
            if (bmp.isRecycled) return null
            bmp
          }
          else -> {
            val width = drawable.intrinsicWidth.coerceAtLeast(1)
            val height = drawable.intrinsicHeight.coerceAtLeast(1)
            val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bmp)
            drawable.setBounds(0, 0, canvas.width, canvas.height)
            drawable.draw(canvas)
            bmp
          }
        }

      // Cap size so listing hundreds of apps doesn't OOM on low-RAM devices.
      val scaled = scaleBitmap(source, MAX_ICON_PX)
      val stream = ByteArrayOutputStream()
      scaled.compress(Bitmap.CompressFormat.PNG, 85, stream)
      if (scaled !== source) scaled.recycle()
      "data:image/png;base64," + Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
    } catch (_: Exception) {
      null
    }
  }

  private fun scaleBitmap(bitmap: Bitmap, maxPx: Int): Bitmap {
    val largest = maxOf(bitmap.width, bitmap.height)
    if (largest <= maxPx) return bitmap
    val scale = maxPx.toFloat() / largest.toFloat()
    val width = (bitmap.width * scale).toInt().coerceAtLeast(1)
    val height = (bitmap.height * scale).toInt().coerceAtLeast(1)
    return Bitmap.createScaledBitmap(bitmap, width, height, true)
  }

  companion object {
    private const val TAG = "MoniAndroidApps"
    private const val MAX_ICON_PX = 96
  }
}
