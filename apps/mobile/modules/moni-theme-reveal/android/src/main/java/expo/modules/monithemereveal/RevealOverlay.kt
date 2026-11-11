package expo.modules.monithemereveal

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.view.Choreographer
import android.view.View
import android.view.ViewGroup
import android.view.animation.PathInterpolator
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/**
 * The old theme's screenshot over the whole window, the status and navigation bar areas included.
 * It never takes a touch: the layout under it is the same, so a tap lands where it looks.
 */
@SuppressLint("ViewConstructor")
internal class RevealOverlay(
  context: Context,
  private val shot: Bitmap,
  private val onRemoved: (RevealOverlay) -> Unit,
) : View(context) {
  var onFirstDraw: Runnable? = null

  private val hole = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_OUT)
  }
  private var cx = 0f
  private var cy = 0f
  private var radius = 0f
  private var running: Choreographer.FrameCallback? = null

  init {
    // The hole punches through this layer only, not through the app drawn below it.
    setLayerType(LAYER_TYPE_HARDWARE, null)
  }

  override fun onDraw(canvas: Canvas) {
    canvas.drawBitmap(shot, 0f, 0f, null)
    if (radius > 0f) canvas.drawCircle(cx, cy, radius, hole)
    onFirstDraw?.let {
      onFirstDraw = null
      post(it)
    }
  }

  /** Grows the hole from `x`, `y` (window px) until it covers the farthest corner. */
  fun open(x: Float, y: Float, durationMs: Long, done: () -> Unit) {
    cx = x
    cy = y
    alpha = 1f
    val far = max(
      max(hypot(x, y), hypot(width - x, y)),
      max(hypot(x, height - y), hypot(width - x, height - y)),
    )
    play(durationMs, done) { t ->
      radius = far * EASE_OUT.getInterpolation(t)
      invalidate()
    }
  }

  fun fadeOut(durationMs: Long, done: () -> Unit) {
    play(durationMs, done) { t -> alpha = 1f - t }
  }

  // Frame time, not a ValueAnimator: with animations off an animator jumps to its end, and the
  // fade that stands in for the circle still has to play.
  private fun play(durationMs: Long, done: () -> Unit, step: (Float) -> Unit) {
    val choreographer = Choreographer.getInstance()
    running?.let { choreographer.removeFrameCallback(it) }
    var start = -1L
    val frame = object : Choreographer.FrameCallback {
      override fun doFrame(now: Long) {
        if (start < 0) start = now
        val t = if (durationMs <= 0) 1f else min((now - start) / 1_000_000f / durationMs, 1f)
        step(t)
        if (t < 1f) {
          choreographer.postFrameCallback(this)
        } else {
          running = null
          (parent as? ViewGroup)?.removeView(this@RevealOverlay)
          done()
        }
      }
    }
    running = frame
    choreographer.postFrameCallback(frame)
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    running?.let { Choreographer.getInstance().removeFrameCallback(it) }
    running = null
    onRemoved(this)
    shot.recycle()
  }

  private companion object {
    // Ease-out, so the circle clears the finger at once: the option under it is still the
    // screenshot until the hole reaches it, and a slow start reads as the control freezing.
    val EASE_OUT = PathInterpolator(0.23f, 1f, 0.32f, 1f)
  }
}
