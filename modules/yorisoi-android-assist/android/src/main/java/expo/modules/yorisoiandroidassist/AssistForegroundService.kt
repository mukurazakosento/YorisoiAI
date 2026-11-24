package expo.modules.yorisoiandroidassist

import android.app.Activity
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.util.DisplayMetrics
import android.view.WindowManager
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Foreground Service that owns the single VirtualDisplay for background assist.
 * Captures on a feature interval (ops ~20s, textExplanation ~4s), runs on-device Japanese OCR, notifies on text change.
 * Does not tap or send on behalf of the user. Does not persist images.
 */
class AssistForegroundService : Service() {
  companion object {
    const val ACTION_START = "expo.modules.yorisoiandroidassist.START"
    const val ACTION_PAUSE = "expo.modules.yorisoiandroidassist.PAUSE"
    const val ACTION_RESUME = "expo.modules.yorisoiandroidassist.RESUME"
    const val ACTION_STOP = "expo.modules.yorisoiandroidassist.STOP"

    const val EXTRA_GOAL = "goalSummary"
    const val EXTRA_FEATURE = "featureId"
    const val EXTRA_VOICE = "voiceEnabled"
    const val EXTRA_INTERVAL_MS = "intervalMs"

    /** Default capture/OCR/guidance cycle (~20s). */
    const val DEFAULT_INTERVAL_MS = 20000L

    @Volatile
    var running: Boolean = false
      private set

    @Volatile
    var paused: Boolean = false
      private set

    @Volatile
    var lastOcrText: String = ""
      private set

    @Volatile
    var lastGuidance: String = ""
      private set

    @Volatile
    var lastStepId: String = ""
      private set

    @Volatile
    var phase: String = "idle"
      private set

    @Volatile
    var frameCount: Int = 0
      private set

    fun resetStatus() {
      running = false
      paused = false
      lastOcrText = ""
      lastGuidance = ""
      lastStepId = ""
      phase = "idle"
      frameCount = 0
    }
  }

  private var mediaProjection: MediaProjection? = null
  private var virtualDisplay: VirtualDisplay? = null
  private var imageReader: ImageReader? = null
  private var handlerThread: HandlerThread? = null
  private var workerHandler: Handler? = null
  private val mainHandler = Handler(Looper.getMainLooper())
  private var tts: AssistTtsHelper? = null
  private var goalSummary: String = ""
  private var featureId: String = "operationSupport"
  private var intervalMs: Long = DEFAULT_INTERVAL_MS
  private var voiceEnabled: Boolean = true
  private val capturing = AtomicBoolean(false)
  private var captureWidth = 720
  private var captureHeight = 1280
  private var captureDpi = 320
  /** Dedupe notify/TTS: step + stage (re-announce on stage change / unreadable recovery). */
  private var announcedStepId: String = ""
  private var announcedStageId: String = ""
  /** Popup stability: same fingerprint across consecutive captures before announce. */
  private var pendingPopupFingerprint: String? = null
  private var popupStreak: Int = 0
  private var announcedPopupFingerprint: String? = null

  private val loopRunnable = object : Runnable {
    override fun run() {
      if (!running || mediaProjection == null) {
        return
      }
      if (!paused) {
        captureAndProcess()
      }
      workerHandler?.postDelayed(this, intervalMs)
    }
  }

  private val projectionCallback = object : MediaProjection.Callback() {
    override fun onStop() {
      mainHandler.post {
        YorisoiAndroidAssistModule.emitPhase("stopped", "MediaProjection stopped by system")
        stopInternal(fromCallback = true)
      }
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    tts = AssistTtsHelper(this)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_PAUSE -> {
        // Notification action — no need to bring UI to foreground.
        if (running) {
          paused = true
          phase = "paused"
          tts?.stop()
          updateForeground("一時停止中（画面は読み取りません）")
          YorisoiAndroidAssistModule.emitPhase("paused", null)
        }
        return START_STICKY
      }
      ACTION_RESUME -> {
        if (running && mediaProjection != null) {
          paused = false
          phase = "running"
          updateForeground("画面を読み取りながら案内しています")
          YorisoiAndroidAssistModule.emitPhase("running", null)
        }
        return START_STICKY
      }
      ACTION_STOP -> {
        stopInternal(fromCallback = false)
        return START_NOT_STICKY
      }
      ACTION_START -> {
        goalSummary = intent.getStringExtra(EXTRA_GOAL).orEmpty()
        featureId = intent.getStringExtra(EXTRA_FEATURE) ?: "operationSupport"
        voiceEnabled = intent.getBooleanExtra(EXTRA_VOICE, true)
        // Allow ~3–60s. Ops defaults to 20s; textExplanation uses ~4s so transient dialogs are not missed.
        // Old min 10s clamp blocked fast popup polling for 文章説明.
        intervalMs = intent.getLongExtra(EXTRA_INTERVAL_MS, DEFAULT_INTERVAL_MS).coerceIn(3000L, 60000L)
        tts?.setEnabled(voiceEnabled)
        if (featureId == "safetyCheck") {
          AssistSafetySession.arm(AssistSafetyInspector.resolveMode(goalSummary))
        } else {
          AssistSafetySession.disarm()
        }
        startProjectionSession()
        return START_STICKY
      }
      else -> return START_NOT_STICKY
    }
  }

  private fun startProjectionSession() {
    if (running) {
      return
    }

    val pending = AssistProjectionHolder.takePendingPermission()
    if (pending == null) {
      phase = "error"
      YorisoiAndroidAssistModule.emitError(
        "NO_PERMISSION",
        "画面共有の許可がありません。もう一度やり直してください。",
      )
      stopSelf()
      return
    }

    val (resultCode, data) = pending
    if (resultCode != Activity.RESULT_OK) {
      phase = "error"
      AssistProjectionHolder.clearAll()
      YorisoiAndroidAssistModule.emitError("DENIED", "画面共有が許可されませんでした。")
      stopSelf()
      return
    }

    AssistNotifier.ensureChannel(this)
    announcedStepId = ""
    announcedStageId = ""
    pendingPopupFingerprint = null
    popupStreak = 0
    announcedPopupFingerprint = null
    lastStepId = ""
    val notification = AssistNotifier.buildForegroundNotification(
      this,
      "画面を読み取りながら案内しています（画像は送りません）",
      paused = false,
    )
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(
        AssistNotifier.FOREGROUND_ID,
        notification,
        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION,
      )
    } else {
      startForeground(AssistNotifier.FOREGROUND_ID, notification)
    }

    val mpm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    val projection = try {
      mpm.getMediaProjection(resultCode, data)
    } catch (e: Exception) {
      phase = "error"
      AssistProjectionHolder.clearAll()
      YorisoiAndroidAssistModule.emitError(
        "PROJECTION_FAILED",
        "画面共有を開始できませんでした: ${e.message ?: "不明"}",
      )
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
      return
    }

    if (projection == null) {
      phase = "error"
      AssistProjectionHolder.clearAll()
      YorisoiAndroidAssistModule.emitError("PROJECTION_NULL", "画面共有を開始できませんでした。")
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
      return
    }

    mediaProjection = projection
    AssistProjectionHolder.setActiveProjection(projection)
    projection.registerCallback(projectionCallback, mainHandler)

    resolveDisplayMetrics()
    imageReader = ImageReader.newInstance(
      captureWidth,
      captureHeight,
      PixelFormat.RGBA_8888,
      2,
    )

    handlerThread = HandlerThread("yorisoi-assist-capture").also { it.start() }
    workerHandler = Handler(handlerThread!!.looper)

    virtualDisplay = projection.createVirtualDisplay(
      "yorisoi-assist-display",
      captureWidth,
      captureHeight,
      captureDpi,
      DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
      imageReader!!.surface,
      null,
      workerHandler,
    )

    running = true
    paused = false
    phase = "running"
    frameCount = 0
    lastOcrText = ""
    // Allow optional AccessibilityService to publish system-dialog text while session runs.
    AssistDialogTextHolder.setSessionActive(true)
    YorisoiAndroidAssistModule.emitPhase("running", null)
    workerHandler?.postDelayed(loopRunnable, 800L)
  }

  private fun resolveDisplayMetrics() {
    val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val metrics = DisplayMetrics()
    @Suppress("DEPRECATION")
    wm.defaultDisplay.getRealMetrics(metrics)
    // Cap resolution for OCR speed / memory; keep aspect ratio.
    val maxW = 720
    val scale = if (metrics.widthPixels > maxW) maxW.toFloat() / metrics.widthPixels else 1f
    captureWidth = (metrics.widthPixels * scale).toInt().coerceAtLeast(360)
    captureHeight = (metrics.heightPixels * scale).toInt().coerceAtLeast(640)
    captureDpi = metrics.densityDpi.coerceIn(160, 480)
  }

  private fun captureAndProcess() {
    if (!capturing.compareAndSet(false, true)) {
      return
    }
    var bitmap: Bitmap? = null
    try {
      val reader = imageReader ?: return
      val image = reader.acquireLatestImage() ?: return
      image.use { img ->
        val plane = img.planes[0]
        val buffer = plane.buffer
        val pixelStride = plane.pixelStride
        val rowStride = plane.rowStride
        val rowPadding = rowStride - pixelStride * captureWidth
        val bitmapWidth = captureWidth + rowPadding / pixelStride
        val raw = Bitmap.createBitmap(bitmapWidth, captureHeight, Bitmap.Config.ARGB_8888)
        raw.copyPixelsFromBuffer(buffer)
        bitmap = if (bitmapWidth != captureWidth) {
          Bitmap.createBitmap(raw, 0, 0, captureWidth, captureHeight).also {
            if (it !== raw) {
              raw.recycle()
            }
          }
        } else {
          raw
        }
      }

      val bmp = bitmap ?: return
      frameCount += 1
      val text = try {
        AssistOcrHelper.recognizeJapanese(bmp)
      } catch (e: Exception) {
        YorisoiAndroidAssistModule.emitError(
          "OCR_FAILED",
          "文字を読み取れませんでした: ${e.message ?: "不明"}",
        )
        return
      } finally {
        if (!bmp.isRecycled) {
          bmp.recycle()
        }
        bitmap = null
      }

      YorisoiAndroidAssistModule.emitFrame(frameCount, text.length)

      val ocrNormalized = text.replace("\\s+".toRegex(), " ").trim()
      // System permission sheets are often missing from MediaProjection (app-share /
      // OEM blanking). Merge recent Accessibility dialog text when OCR is empty or
      // weaker for dialog detection — text only, no images.
      // Safety: also one-shot peek active window when armed (prefer a11y for phone/email).
      val a11yText = collectAssistTextForFeature()
      val normalized =
        if (featureId == "safetyCheck") {
          val mode = AssistSafetyInspector.resolveMode(goalSummary)
          AssistSafetyInspector.pickBestSafetyText(ocrNormalized, a11yText, mode)
        } else {
          pickBestDialogText(ocrNormalized, a11yText)
        }
      val ocrChanged = normalized != lastOcrText
      if (normalized.isNotEmpty()) {
        lastOcrText = normalized
      }

      val guidance = resolveGuidance(normalized, ocrChanged) ?: return

      // Same step/stage → skip; stage change or unreadable recovery → re-announce
      if (
        !AssistGuidanceRules.shouldAnnounce(
          announcedStepId,
          guidance.stepId,
          announcedStageId,
          guidance.stageId,
        )
      ) {
        return
      }
      announcedStepId = guidance.stepId
      announcedStageId = guidance.stageId
      lastStepId = guidance.stepId
      // Redact PII for notify / FGS / TTS / emitted display (OCR quotes may leak secrets).
      val safeDisplay = AssistSecretRedactor.forPublicText(guidance.displayText)
      val safeVoice = AssistSecretRedactor.forVoice(guidance.voiceText)
      lastGuidance = safeDisplay
      // Safety results: notify + TTS only — do not reopen the Activity on tap.
      val openAppOnTap = featureId != "safetyCheck"
      AssistNotifier.showGuidance(this, "よりそいAI", safeDisplay, openAppOnTap)
      updateForeground(safeDisplay)
      if (voiceEnabled) {
        tts?.speakLatest(safeVoice)
      }
      YorisoiAndroidAssistModule.emitOcrChanged(
        text = normalized,
        displayText = safeDisplay,
        voiceText = safeVoice,
        mode = guidance.mode,
        stepId = guidance.stepId,
        stageId = guidance.stageId,
      )
    } catch (e: Exception) {
      YorisoiAndroidAssistModule.emitError(
        "CAPTURE_FAILED",
        "画面の取得に失敗しました: ${e.message ?: "不明"}",
      )
    } finally {
      bitmap?.let {
        if (!it.isRecycled) {
          it.recycle()
        }
      }
      capturing.set(false)
    }
  }

  /**
   * Popup-first path: stable dialog → grounded explain (dedupe by fingerprint).
   * Else feature path: textExplanation uses OCR summary; operationSupport uses stages.
   * Safety: skip popup path — detect phone/email and advise in background.
   * Returns null when nothing new to announce this capture.
   */
  private fun resolveGuidance(
    normalized: String,
    ocrChanged: Boolean,
  ): AssistGuidanceRules.Step? {
    if (normalized.isEmpty()) {
      pendingPopupFingerprint = null
      popupStreak = 0
      return AssistGuidanceRules.unreadableStep()
    }

    // 安全性: 電話／メール検出を優先（許可ポップアップ経路で止めない）
    if (featureId == "safetyCheck") {
      if (!ocrChanged && announcedStepId.isNotEmpty() &&
        announcedStageId != "unreadable" &&
        announcedStageId != "safety-wait"
      ) {
        // Keep re-checking while waiting; once a result fingerprint is announced, stay quiet
        // until OCR changes (new number/email).
        return null
      }
      return AssistGuidanceRules.buildNextStep(
        featureId = featureId,
        goalSummary = goalSummary,
        ocrText = normalized,
      )
    }

    val detection = AssistPopupDetector.detect(normalized)
    if (detection != null) {
      if (detection.fingerprint == pendingPopupFingerprint) {
        popupStreak += 1
      } else {
        pendingPopupFingerprint = detection.fingerprint
        popupStreak = 1
      }
      // textExplanation: always streak 1 (dialogs are brief). Ops: 1 at ≥15s / strong, else 2.
      val needed = AssistPopupDetector.requiredStreak(detection, intervalMs, featureId)
      val stable = AssistPopupDetector.isStable(pendingPopupFingerprint, detection, popupStreak, needed)
      if (!stable) {
        // Do not go silent for 文章説明 while waiting — summarize OCR now.
        if (featureId == "textExplanation" && ocrChanged) {
          return AssistPopupExplainer.explainScreenText(normalized)
        }
        return null
      }
      if (announcedPopupFingerprint == detection.fingerprint) {
        // Same dialog still visible: ops stays quiet; textExplanation already explained.
        return null
      }
      announcedPopupFingerprint = detection.fingerprint
      // Same popup path for operationSupport and textExplanation (notify+TTS upstream).
      return AssistPopupExplainer.explain(detection)
    }

    // Dialog gone — resume stage / text guidance.
    pendingPopupFingerprint = null
    popupStreak = 0
    announcedPopupFingerprint = null

    if (!ocrChanged && announcedStepId.isNotEmpty() && announcedStageId != "unreadable") {
      return null
    }

    return AssistGuidanceRules.buildNextStep(
      featureId = featureId,
      goalSummary = goalSummary,
      ocrText = normalized,
    )
  }

  /**
   * Dialog holder text for ops/text; prefer live visible a11y peek over retained text
   * so a dismissed camera sheet cannot be re-explained from a stale holder.
   * Safety also peeks the active window when armed.
   */
  private fun collectAssistTextForFeature(): String {
    val recent = AssistDialogTextHolder.peekRecent()
    val peeked =
      if (AssistDialogAccessibilityService.isServiceConnected()) {
        AssistDialogAccessibilityService.peekActiveWindowText()
      } else {
        ""
      }

    if (featureId == "safetyCheck" && AssistSafetySession.isArmed()) {
      if (peeked.isBlank()) {
        return recent
      }
      if (recent.isBlank()) {
        return peeked
      }
      val mode = AssistSafetyInspector.resolveMode(goalSummary)
      return AssistSafetyInspector.pickBestSafetyText(recent, peeked, mode)
    }

    // Ops / textExplanation: live dialog text wins; clear holder when dialog is gone.
    val liveDialog = peeked.isNotBlank() && AssistPopupDetector.detect(peeked) != null
    if (liveDialog) {
      AssistDialogTextHolder.publish(peeked)
      return peeked
    }
    if (recent.isNotBlank() && AssistPopupDetector.detect(recent) != null) {
      // Retained text but live window is not a dialog → phantom risk; drop it.
      if (peeked.isNotBlank() || AssistDialogAccessibilityService.isServiceConnected()) {
        AssistDialogTextHolder.clear()
        return ""
      }
      return recent
    }
    return recent
  }

  /**
   * Prefer text that looks like a system/app permission dialog.
   * Accessibility fill-in wins when OCR is empty or OCR is not dialog-like.
   */
  private fun pickBestDialogText(ocrText: String, a11yText: String): String {
    if (a11yText.isBlank()) {
      return ocrText
    }
    if (ocrText.isBlank()) {
      return a11yText
    }
    val ocrDialog = AssistPopupDetector.detect(ocrText) != null
    val a11yDialog = AssistPopupDetector.detect(a11yText) != null
    return when {
      a11yDialog && !ocrDialog -> a11yText
      a11yDialog && ocrDialog && a11yText.length >= ocrText.length -> a11yText
      else -> ocrText
    }
  }

  private fun updateForeground(body: String) {
    val notification = AssistNotifier.buildForegroundNotification(this, body, paused)
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
    manager.notify(AssistNotifier.FOREGROUND_ID, notification)
  }

  private fun stopInternal(fromCallback: Boolean) {
    workerHandler?.removeCallbacks(loopRunnable)
    running = false
    paused = false
    phase = "stopped"

    try {
      virtualDisplay?.release()
    } catch (_: Exception) {
    }
    virtualDisplay = null

    try {
      imageReader?.close()
    } catch (_: Exception) {
    }
    imageReader = null

    try {
      mediaProjection?.unregisterCallback(projectionCallback)
    } catch (_: Exception) {
    }
    try {
      mediaProjection?.stop()
    } catch (_: Exception) {
    }
    mediaProjection = null

    // Explicitly clear holder so the old token cannot be reused.
    AssistProjectionHolder.clearAll()
    AssistDialogTextHolder.setSessionActive(false)
    AssistSafetySession.disarm()

    tts?.stop()
    AssistNotifier.cancelGuidance(this)

    try {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } catch (_: Exception) {
    }

    handlerThread?.quitSafely()
    handlerThread = null
    workerHandler = null

    if (!fromCallback) {
      YorisoiAndroidAssistModule.emitPhase("stopped", null)
    }
    stopSelf()
  }

  override fun onDestroy() {
    if (running || mediaProjection != null) {
      stopInternal(fromCallback = false)
    }
    tts?.shutdown()
    tts = null
    super.onDestroy()
  }
}
