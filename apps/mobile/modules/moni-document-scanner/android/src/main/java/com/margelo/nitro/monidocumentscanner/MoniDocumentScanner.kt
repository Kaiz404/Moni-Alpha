package com.margelo.nitro.monidocumentscanner

import android.app.Activity
import android.content.Intent
import android.content.IntentSender
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.ActivityEventListener
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise

@DoNotStrip
class MoniDocumentScanner : HybridMoniDocumentScannerSpec(), ActivityEventListener {

  companion object {
    private const val SCAN_REQUEST_CODE = 0x4D4F4E49 // "MONI"
  }

  @Volatile
  private var pendingPromise: Promise<ScanResult>? = null

  init {
    NitroModules.applicationContext?.addActivityEventListener(this)
  }

  override fun scanDocument(options: ScanOptions): Promise<ScanResult> {
    check(pendingPromise == null) { "A scan is already in progress." }

    val promise = Promise<ScanResult>()
    pendingPromise = promise

    val reactContext = NitroModules.applicationContext
      ?: run {
        promise.reject(Exception("ReactApplicationContext is not available."))
        pendingPromise = null
        return promise
      }

    val activity = reactContext.currentActivity
      ?: run {
        promise.reject(Exception("No Activity is currently active."))
        pendingPromise = null
        return promise
      }

    val scannerMode = when (options.scannerMode) {
      ScannerMode.BASE -> GmsDocumentScannerOptions.SCANNER_MODE_BASE
      ScannerMode.BASE_WITH_FILTER -> GmsDocumentScannerOptions.SCANNER_MODE_BASE_WITH_FILTER
      else -> GmsDocumentScannerOptions.SCANNER_MODE_FULL
    }

    val maxPages = options.maxNumDocuments?.toInt()?.coerceIn(1, 100) ?: 1
    val galleryAllowed = options.galleryImportAllowed ?: true

    val gmsOptions = GmsDocumentScannerOptions.Builder()
      .setScannerMode(scannerMode)
      .setGalleryImportAllowed(galleryAllowed)
      .setPageLimit(maxPages)
      .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
      .build()

    GmsDocumentScanning.getClient(gmsOptions)
      .getStartScanIntent(activity)
      .addOnSuccessListener { intentSender: IntentSender ->
        try {
          activity.startIntentSenderForResult(
            intentSender,
            SCAN_REQUEST_CODE,
            null,
            0,
            0,
            0,
          )
        } catch (e: IntentSender.SendIntentException) {
          pendingPromise?.reject(e)
          pendingPromise = null
        }
      }
      .addOnFailureListener { e ->
        pendingPromise?.reject(e)
        pendingPromise = null
      }

    return promise
  }

  override fun onActivityResult(
    activity: Activity,
    requestCode: Int,
    resultCode: Int,
    data: Intent?,
  ) {
    if (requestCode != SCAN_REQUEST_CODE) return

    val promise = pendingPromise ?: return
    pendingPromise = null

    if (resultCode != Activity.RESULT_OK) {
      promise.reject(Exception("User cancelled the scan (resultCode=$resultCode)."))
      return
    }

    val result = GmsDocumentScanningResult.fromActivityResultIntent(data)
    if (result == null) {
      promise.reject(Exception("GmsDocumentScanningResult is null."))
      return
    }

    val pages = result.pages?.map { page ->
      ScannedPage(uri = page.imageUri.toString())
    }?.toTypedArray() ?: emptyArray()

    promise.resolve(ScanResult(pages = pages))
  }

  override fun onNewIntent(intent: Intent) {}
}
