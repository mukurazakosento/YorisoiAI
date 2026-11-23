package expo.modules.yorisoiandroidassist

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Always-on dialog explainer (primary path for 文章説明 of system permission sheets).
 *
 * When the user enables this service in Android Settings, it keeps running with the
 * YorisoiAI Activity closed. On permission/confirm dialogs it reads text, explains
 * via notify + TTS, and never auto-taps. Does **not** require MediaProjection or
 * [AssistDialogTextHolder.sessionActive].
 */
class AssistDialogAccessibilityService : AccessibilityService() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var tts: AssistTtsHelper? = null

  @Volatile
  private var lastAnnouncedFingerprint: String? = null

  @Volatile
  private var lastAnnounceAtMs: Long = 0L

  @Volatile
  private var debounceRunnable: Runnable? = null

  override fun onServiceConnected() {
    super.onServiceConnected()
    instance = this
    if (tts == null) {
      tts = AssistTtsHelper(this)
    }
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) {
      return
    }
    if (
      event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
      event.eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
    ) {
      return
    }

    val pkg = event.packageName?.toString().orEmpty()
    // Never explain our own UI; never treat bare SystemUI as dialog without cues.
    if (pkg == packageName) {
      return
    }

    // Debounce rapid content-change spam from the same window.
    debounceRunnable?.let { mainHandler.removeCallbacks(it) }
    val pending =
      Runnable {
        processWindow(pkg)
      }
    debounceRunnable = pending
    mainHandler.postDelayed(pending, DEBOUNCE_MS)
  }

  private fun processWindow(pkg: String) {
    val root = rootInActiveWindow ?: return
    try {
      val collected = StringBuilder()
      collectText(root, collected, depth = 0)
      val text = collected.toString().replace("\\s+".toRegex(), " ").trim()
      if (text.length < 4) {
        return
      }

      if (!isExplainWorthyDialog(pkg, text)) {
        return
      }

      val detection = AssistPopupDetector.detect(text) ?: return

      // Also publish for MediaProjection FGS merge when an ops/text session is running.
      AssistDialogTextHolder.publish(text)

      val now = System.currentTimeMillis()
      if (detection.fingerprint == lastAnnouncedFingerprint &&
        now - lastAnnounceAtMs < DEDUPE_MS
      ) {
        return
      }

      val step = AssistPopupExplainer.explain(detection)
      val safeDisplay = AssistSecretRedactor.forPublicText(step.displayText)
      val safeVoice = AssistSecretRedactor.forVoice(step.voiceText)

      lastAnnouncedFingerprint = detection.fingerprint
      lastAnnounceAtMs = now

      // Notify + TTS without bringing the Activity to the front.
      AssistNotifier.showGuidance(this, "よりそいAI", safeDisplay)
      tts?.speakLatest(safeVoice)

      YorisoiAndroidAssistModule.emitOcrChanged(
        text = text.take(800),
        displayText = safeDisplay,
        voiceText = safeVoice,
        mode = step.mode,
        stepId = step.stepId,
        stageId = step.stageId,
      )
    } finally {
      try {
        root.recycle()
      } catch (_: Exception) {
      }
    }
  }

  override fun onInterrupt() {
    tts?.stop()
  }

  override fun onDestroy() {
    debounceRunnable?.let { mainHandler.removeCallbacks(it) }
    debounceRunnable = null
    tts?.shutdown()
    tts = null
    if (instance === this) {
      instance = null
    }
    AssistDialogTextHolder.clear()
    super.onDestroy()
  }

  /**
   * One-shot text from the active window. Only for user-armed safety reads.
   * Does not announce, notify, or auto-tap.
   */
  fun collectActiveWindowText(): String {
    val root = rootInActiveWindow ?: return ""
    try {
      val collected = StringBuilder()
      collectText(root, collected, depth = 0)
      return collected.toString().replace("\\s+".toRegex(), " ").trim()
    } finally {
      try {
        root.recycle()
      } catch (_: Exception) {
      }
    }
  }

  /**
   * Only permission / consent / update dialogs — not home, notifications, or generic screens.
   * Do not accept com.android.systemui solely by package name.
   */
  private fun isExplainWorthyDialog(pkg: String, text: String): Boolean {
    val n = text.lowercase().replace("\\s+".toRegex(), "")
    // Skip notification / QS style noise when no permission cues.
    if (looksLikeNotificationShade(n) && !hasPermissionCue(n)) {
      return false
    }
    // Detector match is the primary gate (structure + topic + buttons).
    if (AssistPopupDetector.detect(text) != null) {
      return true
    }
    // PermissionController package with strong topic still counts if OCR-like text is thin.
    val permissionPkg =
      pkg.contains("permissioncontroller", ignoreCase = true) ||
        pkg.contains("android.permission", ignoreCase = true)
    return permissionPkg && hasPermissionCue(n)
  }

  private fun hasPermissionCue(n: String): Boolean {
    return n.contains("許可") ||
      n.contains("アクセス") ||
      n.contains("位置") ||
      n.contains("カメラ") ||
      n.contains("マイク") ||
      n.contains("通知") ||
      n.contains("連絡先") ||
      n.contains("写真") ||
      n.contains("同意") ||
      n.contains("allow") ||
      n.contains("location") ||
      n.contains("camera") ||
      n.contains("microphone") ||
      n.contains("notification") ||
      (n.contains("正確な位置") && n.contains("おおよそ"))
  }

  private fun looksLikeNotificationShade(n: String): Boolean {
    return n.contains("通知シェード") ||
      n.contains("クイック設定") ||
      (n.contains("昨日") && n.contains("通知")) ||
      n.contains("clearall")
  }

  private fun collectText(node: AccessibilityNodeInfo?, out: StringBuilder, depth: Int) {
    if (node == null || depth > 24) {
      return
    }
    val own = node.text?.toString()?.trim().orEmpty()
    val desc = node.contentDescription?.toString()?.trim().orEmpty()
    if (own.isNotEmpty()) {
      if (out.isNotEmpty()) out.append(' ')
      out.append(own)
    } else if (desc.isNotEmpty()) {
      if (out.isNotEmpty()) out.append(' ')
      out.append(desc)
    }
    for (i in 0 until node.childCount) {
      val child = node.getChild(i) ?: continue
      try {
        collectText(child, out, depth + 1)
      } finally {
        try {
          child.recycle()
        } catch (_: Exception) {
        }
      }
    }
  }

  companion object {
    private const val DEBOUNCE_MS = 600L
    private const val DEDUPE_MS = 45_000L

    @Volatile
    private var instance: AssistDialogAccessibilityService? = null

    /**
     * Peek active window text when the service is connected.
     * Callers must gate with [AssistSafetySession.isArmed].
     */
    fun peekActiveWindowText(): String {
      return instance?.collectActiveWindowText().orEmpty()
    }

    fun isServiceConnected(): Boolean {
      return instance != null
    }
  }
}
