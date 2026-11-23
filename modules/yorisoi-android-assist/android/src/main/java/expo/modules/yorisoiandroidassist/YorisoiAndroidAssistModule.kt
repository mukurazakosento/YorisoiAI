package expo.modules.yorisoiandroidassist

import android.accessibilityservice.AccessibilityServiceInfo
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionConfig
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicReference

/**
 * Expo bridge for Android background assist (MediaProjection + FGS).
 * iOS / Web never load this module.
 */
class YorisoiAndroidAssistModule : Module() {
  companion object {
    private const val REQUEST_MEDIA_PROJECTION = 28833

    @Volatile
    private var eventEmitter: ((String, Map<String, Any?>) -> Unit)? = null

    fun emitPhase(phase: String, detail: String?) {
      val body = mutableMapOf<String, Any?>("phase" to phase)
      if (detail != null) {
        body["detail"] = detail
      }
      eventEmitter?.invoke("onPhase", body)
    }

    fun emitFrame(frameCount: Int, textLength: Int) {
      eventEmitter?.invoke(
        "onFrame",
        mapOf(
          "frameCount" to frameCount,
          "textLength" to textLength,
          "timestamp" to System.currentTimeMillis(),
        ),
      )
    }

    fun emitOcrChanged(
      text: String,
      displayText: String,
      voiceText: String,
      mode: String,
      stepId: String,
      stageId: String = "",
    ) {
      eventEmitter?.invoke(
        "onOcrChanged",
        mapOf(
          "text" to text.take(800),
          "displayText" to displayText,
          "voiceText" to voiceText,
          "mode" to mode,
          "stepId" to stepId,
          "stageId" to stageId,
          "timestamp" to System.currentTimeMillis(),
        ),
      )
    }

    fun emitError(code: String, message: String) {
      eventEmitter?.invoke(
        "onError",
        mapOf(
          "code" to code,
          "message" to message,
        ),
      )
    }
  }

  private val permissionPromise = AtomicReference<Promise?>(null)

  override fun definition() = ModuleDefinition {
    Name("YorisoiAndroidAssist")

    Events("onPhase", "onFrame", "onOcrChanged", "onError")

    OnCreate {
      eventEmitter = { eventName, payload ->
        try {
          this@YorisoiAndroidAssistModule.sendEvent(eventName, payload)
        } catch (_: Exception) {
          // JS may be gone; FGS still notifies via system notification / TTS
        }
      }
    }

    OnDestroy {
      eventEmitter = null
    }

    Function("isSupported") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP
    }

    Function("getStatus") {
      mapOf(
        "phase" to AssistForegroundService.phase,
        "running" to AssistForegroundService.running,
        "paused" to AssistForegroundService.paused,
        "frameCount" to AssistForegroundService.frameCount,
        "lastGuidance" to AssistForegroundService.lastGuidance,
        "lastStepId" to AssistForegroundService.lastStepId,
        "hasOcrText" to AssistForegroundService.lastOcrText.isNotBlank(),
      )
    }

    AsyncFunction("requestPermission") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject(
          "NO_ACTIVITY",
          "画面共有の許可画面を出せません。アプリを前面にしてからもう一度試してください。",
          null,
        )
        return@AsyncFunction
      }
      if (AssistForegroundService.running) {
        promise.resolve(
          mapOf(
            "granted" to true,
            "alreadyRunning" to true,
          ),
        )
        return@AsyncFunction
      }

      val previous = permissionPromise.getAndSet(promise)
      previous?.reject("SUPERSEDED", "新しい許可リクエストに置き換えられました。", null)

      val mpm =
        activity.getSystemService(Activity.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      // Android 14+ default offers single-app share, which excludes system UI
      // (PermissionController 位置情報/カメラ等). Force entire-display capture so
      // system permission sheets can appear in the VirtualDisplay when the OEM allows.
      val captureIntent =
        if (Build.VERSION.SDK_INT >= 34) {
          try {
            mpm.createScreenCaptureIntent(MediaProjectionConfig.createConfigForDefaultDisplay())
          } catch (_: Exception) {
            mpm.createScreenCaptureIntent()
          }
        } else {
          mpm.createScreenCaptureIntent()
        }
      try {
        activity.startActivityForResult(captureIntent, REQUEST_MEDIA_PROJECTION)
      } catch (e: Exception) {
        permissionPromise.set(null)
        promise.reject(
          "PERMISSION_START_FAILED",
          "画面共有の許可を開始できませんでした: ${e.message ?: "不明"}",
          e,
        )
      }
    }

    Function("isDialogAccessibilityEnabled") {
      val context = appContext.reactContext ?: return@Function false
      isOurAccessibilityEnabled(context)
    }

    /**
     * Arm one-shot safety screen read after the user chose phone / email.
     * Does not start continuous capture or change always-on popup explain.
     */
    Function("armSafetyScreenRead") { mode: String ->
      AssistSafetySession.arm(mode)
      mapOf(
        "ok" to AssistSafetySession.isArmed(),
        "mode" to AssistSafetySession.currentMode(),
      )
    }

    Function("disarmSafetyScreenRead") {
      AssistSafetySession.disarm()
      mapOf("ok" to true)
    }

    Function("isSafetyScreenReadArmed") {
      AssistSafetySession.isArmed()
    }

    /**
     * One-shot peek of active window text for armed safety mode.
     * Prefers AccessibilityService; empty when not armed / not connected.
     */
    Function("peekSafetyScreenText") {
      if (!AssistSafetySession.isArmed()) {
        return@Function mapOf(
          "text" to "",
          "source" to "none",
          "mode" to "",
          "detail" to "安全性チェックの電話／メール選択後のみ読み取れます。",
        )
      }
      if (!AssistDialogAccessibilityService.isServiceConnected()) {
        return@Function mapOf(
          "text" to "",
          "source" to "none",
          "mode" to AssistSafetySession.currentMode(),
          "detail" to "AccessibilityService がオフのため、画面の文字をこちらでは取れません。スクショ読み取りをお使いください。",
        )
      }
      val text = AssistDialogAccessibilityService.peekActiveWindowText().take(2000)
      // Also stash briefly so FGS merge can see it if a session is somehow running.
      if (text.length >= 4) {
        AssistDialogTextHolder.publish(text)
      }
      mapOf(
        "text" to text,
        "source" to if (text.isNotBlank()) "accessibility" else "empty",
        "mode" to AssistSafetySession.currentMode(),
        "detail" to if (text.isNotBlank()) {
          "画面の文字を読み取りました（画像は使いません）。"
        } else {
          "画面から文字を取れませんでした。"
        },
      )
    }

    AsyncFunction("openDialogAccessibilitySettings") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("NO_CONTEXT", "設定を開けませんでした。", null)
        return@AsyncFunction
      }
      try {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        promise.resolve(mapOf("ok" to true))
      } catch (e: Exception) {
        promise.reject(
          "SETTINGS_FAILED",
          "設定アプリを開けませんでした: ${e.message ?: "不明"}",
          e,
        )
      }
    }

    AsyncFunction("startAssist") { options: Map<String, Any?>, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("NO_CONTEXT", "アプリの準備が整っていません。", null)
        return@AsyncFunction
      }
      if (AssistForegroundService.running) {
        promise.resolve(mapOf("ok" to true, "alreadyRunning" to true))
        return@AsyncFunction
      }
      if (!AssistProjectionHolder.hasPendingPermission()) {
        promise.reject(
          "NO_PERMISSION",
          "画面共有の許可がまだありません。先に許可ダイアログを完了してください。",
          null,
        )
        return@AsyncFunction
      }

      val goal = (options["goalSummary"] as? String).orEmpty()
      val featureId = (options["featureId"] as? String) ?: "operationSupport"
      val voiceEnabled = options["voiceEnabled"] as? Boolean ?: true
      val intervalMs = (options["intervalMs"] as? Number)?.toLong() ?: 20000L

      val intent = Intent(context, AssistForegroundService::class.java).apply {
        action = AssistForegroundService.ACTION_START
        putExtra(AssistForegroundService.EXTRA_GOAL, goal)
        putExtra(AssistForegroundService.EXTRA_FEATURE, featureId)
        putExtra(AssistForegroundService.EXTRA_VOICE, voiceEnabled)
        putExtra(AssistForegroundService.EXTRA_INTERVAL_MS, intervalMs)
      }

      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
        promise.resolve(mapOf("ok" to true))
      } catch (e: Exception) {
        promise.reject(
          "START_FAILED",
          "背面支援を開始できませんでした: ${e.message ?: "不明"}",
          e,
        )
      }
    }

    AsyncFunction("pauseAssist") { promise: Promise ->
      sendServiceAction(AssistForegroundService.ACTION_PAUSE, promise)
    }

    AsyncFunction("resumeAssist") { promise: Promise ->
      sendServiceAction(AssistForegroundService.ACTION_RESUME, promise)
    }

    AsyncFunction("stopAssist") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        AssistProjectionHolder.clearAll()
        AssistForegroundService.resetStatus()
        promise.resolve(mapOf("ok" to true))
        return@AsyncFunction
      }
      try {
        val intent = Intent(context, AssistForegroundService::class.java).apply {
          action = AssistForegroundService.ACTION_STOP
        }
        context.startService(intent)
        AssistProjectionHolder.clearAll()
        promise.resolve(mapOf("ok" to true))
      } catch (e: Exception) {
        AssistProjectionHolder.clearAll()
        AssistForegroundService.resetStatus()
        promise.resolve(mapOf("ok" to true, "detail" to (e.message ?: "")))
      }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_MEDIA_PROJECTION) {
        return@OnActivityResult
      }
      val promise = permissionPromise.getAndSet(null) ?: return@OnActivityResult
      val resultCode = payload.resultCode
      val data = payload.data
      if (resultCode == Activity.RESULT_OK && data != null) {
        AssistProjectionHolder.stashPermissionResult(resultCode, data)
        promise.resolve(
          mapOf(
            "granted" to true,
            "alreadyRunning" to false,
          ),
        )
      } else {
        AssistProjectionHolder.clearAll()
        promise.resolve(
          mapOf(
            "granted" to false,
            "alreadyRunning" to false,
          ),
        )
      }
    }
  }

  private fun sendServiceAction(action: String, promise: Promise) {
    val context = appContext.reactContext
    if (context == null) {
      promise.reject("NO_CONTEXT", "アプリの準備が整っていません。", null)
      return
    }
    try {
      val intent = Intent(context, AssistForegroundService::class.java).apply {
        this.action = action
      }
      context.startService(intent)
      promise.resolve(mapOf("ok" to true))
    } catch (e: Exception) {
      promise.reject("ACTION_FAILED", e.message ?: "failed", e)
    }
  }

  private fun isOurAccessibilityEnabled(context: Context): Boolean {
    val am = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
      ?: return false
    val enabled = am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
      ?: return false
    val target = AssistDialogAccessibilityService::class.java.name
    return enabled.any { info ->
      val id = info.resolveInfo?.serviceInfo?.let { "${it.packageName}/${it.name}" }.orEmpty()
      id.contains(target) || info.resolveInfo?.serviceInfo?.name == target
    }
  }
}
