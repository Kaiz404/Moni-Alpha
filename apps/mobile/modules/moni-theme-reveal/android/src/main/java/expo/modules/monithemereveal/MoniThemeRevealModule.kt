package expo.modules.monithemereveal

import android.app.Activity
import android.content.Context
import android.graphics.Bitmap
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.PixelCopy
import android.view.ViewGroup
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MoniThemeRevealModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  private var overlay: RevealOverlay? = null
  private var capturing = false

  // A screenshot left up would freeze the app's look, so one nobody reveals fades out on its own.
  private val abandon = Runnable { overlay?.fadeOut(FADE_MS) {} }

  override fun definition() = ModuleDefinition {
    Name("MoniThemeReveal")

    AsyncFunction("capture") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O || overlay != null || capturing) {
        promise.resolve(false)
      } else {
        capture(activity, promise)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("reveal") { x: Double, y: Double, durationMs: Int, promise: Promise ->
      val shown = overlay
      if (shown == null) {
        promise.resolve(null)
      } else {
        main.removeCallbacks(abandon)
        val density = shown.resources.displayMetrics.density
        // JS measures from the React root, which sits inside the window's content view.
        val content = IntArray(2)
        (shown.parent as? ViewGroup)
          ?.findViewById<ViewGroup>(android.R.id.content)
          ?.getLocationInWindow(content)
        val scale = animatorScale(shown.context)
        if (scale == 0f) {
          shown.fadeOut(FADE_MS) { promise.resolve(null) }
        } else {
          shown.open(
            x.toFloat() * density + content[0],
            y.toFloat() * density + content[1],
            (durationMs * scale).toLong(),
          ) { promise.resolve(null) }
        }
      }
    }.runOnQueue(Queues.MAIN)
  }

  private fun capture(activity: Activity, promise: Promise) {
    val window = activity.window
    val decor = window.decorView as ViewGroup
    if (decor.width == 0 || decor.height == 0) {
      promise.resolve(false)
      return
    }
    val bitmap = Bitmap.createBitmap(decor.width, decor.height, Bitmap.Config.ARGB_8888)
    capturing = true
    PixelCopy.request(window, bitmap, { result ->
      capturing = false
      if (result != PixelCopy.SUCCESS || activity.isFinishing || overlay != null) {
        bitmap.recycle()
        promise.resolve(false)
      } else {
        show(decor, RevealOverlay(activity, bitmap, ::forget), promise)
      }
    }, main)
  }

  private fun show(decor: ViewGroup, shown: RevealOverlay, promise: Promise) {
    overlay = shown
    var answered = false
    val answer = Runnable {
      if (!answered) {
        answered = true
        promise.resolve(true)
      }
    }
    shown.onFirstDraw = answer
    // A window that never draws (the app went to the background) must not hold the switch.
    main.postDelayed(answer, FIRST_DRAW_WAIT_MS)
    main.postDelayed(abandon, ABANDON_MS)
    decor.addView(
      shown,
      ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
    )
  }

  private fun forget(gone: RevealOverlay) {
    if (overlay === gone) overlay = null
    main.removeCallbacks(abandon)
  }

  private fun animatorScale(context: Context): Float =
    Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f)

  private companion object {
    const val FADE_MS = 180L
    const val FIRST_DRAW_WAIT_MS = 120L
    const val ABANDON_MS = 3000L
  }
}
