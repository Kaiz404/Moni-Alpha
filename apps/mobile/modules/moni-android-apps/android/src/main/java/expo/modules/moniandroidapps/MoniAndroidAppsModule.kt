package expo.modules.moniandroidapps

import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.util.Base64
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream

class MoniAndroidAppsModule : Module() {
  private val reactContext
    get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {
    Name("MoniAndroidApps")

    AsyncFunction("getInstalledLauncherAppsAsync") {
      getInstalledLauncherApps()
    }

    AsyncFunction("getAppInfoAsync") { packageName: String ->
      getAppInfo(packageName.trim())
    }
  }

  private fun getInstalledLauncherApps(): List<Map<String, Any?>> {
    val pm = reactContext.packageManager
    val intent = Intent(Intent.ACTION_MAIN, null).addCategory(Intent.CATEGORY_LAUNCHER)

    @Suppress("DEPRECATION")
    val resolves =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        pm.queryIntentActivities(
          intent,
          PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_ALL.toLong()),
        )
      } else {
        pm.queryIntentActivities(intent, PackageManager.MATCH_ALL)
      }

    Log.d(TAG, "queryIntentActivities returned ${resolves.size} launcher activities")

    val seen = mutableSetOf<String>()
    val out = mutableListOf<Map<String, Any?>>()

    for (resolve in resolves) {
      try {
        val pkg = resolve.activityInfo?.packageName ?: continue
        if (!seen.add(pkg)) continue

        val appInfo = resolve.activityInfo.applicationInfo ?: continue
        val label = pm.getApplicationLabel(appInfo).toString().trim()
        if (label.isEmpty()) continue

        out.add(
          mapOf(
            "packageName" to pkg,
            "label" to label,
            // Icons are optional — never fail the whole list for one bad drawable.
            "iconUri" to drawableToDataUri(pm.getApplicationIcon(appInfo)),
          ),
        )
      } catch (error: Exception) {
        Log.w(TAG, "Skipping launcher app due to error", error)
      }
    }

    Log.d(TAG, "Returning ${out.size} unique installed launcher apps")
    return out.sortedBy { (it["label"] as String).lowercase() }
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
