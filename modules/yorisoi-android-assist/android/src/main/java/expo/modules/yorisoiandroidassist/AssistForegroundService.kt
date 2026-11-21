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
 * Captures ~every 3s, runs on-device Japanese OCR, notifies on text change.
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

    const val DEFAULT_INTERVAL_MS = 3000L

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
        paused = true
        phase = "paused"
        tts?.stop()
        updateForeground("一時停止中（画面は読み取りません）")
        YorisoiAndroidAssistModule.emitPhase("paused", null)
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
        intervalMs = intent.getLongExtra(EXTRA_INTERVAL_MS, DEFAULT_INTERVAL_MS).coerceIn(2000L, 10000L)
        tts?.setEnabled(voiceEnabled)
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
    val notification = AssistNotifier.buildForegroundNotification(
      this,
      "画面を読み取りながら案内しています（画像は送りません）",
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

      val normalized = text.replace("\\s+".toRegex(), " ").trim()
      if (normalized.isEmpty()) {
        return
      }
      if (normalized == lastOcrText) {
        return
      }
      lastOcrText = normalized

      val guidance = AssistGuidanceRules.buildNextStep(
        featureId = featureId,
        goalSummary = goalSummary,
        ocrText = normalized,
      )
      lastGuidance = guidance.displayText
      AssistNotifier.showGuidance(this, "よりそいAI", guidance.displayText)
      if (voiceEnabled) {
        tts?.speak(guidance.voiceText)
      }
      YorisoiAndroidAssistModule.emitOcrChanged(
        text = normalized,
        displayText = guidance.displayText,
        voiceText = guidance.voiceText,
        mode = guidance.mode,
        stepId = guidance.stepId,
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

  private fun updateForeground(body: String) {
    val notification = AssistNotifier.buildForegroundNotification(this, body)
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
