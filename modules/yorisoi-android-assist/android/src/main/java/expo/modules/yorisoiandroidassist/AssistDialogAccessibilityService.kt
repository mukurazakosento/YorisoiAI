package expo.modules.yorisoiandroidassist

import android.accessibilityservice.AccessibilityService
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo

/**
 * Always-on dialog explainer (primary path for 文章説明 of system permission sheets).
 *
 * When the user enables this service in Android Settings, it keeps running with the
 * YorisoiAI Activity closed. On permission/confirm dialogs it reads text, explains
 * via notify + TTS, and never auto-taps. Does **not** require MediaProjection or
 * [AssistDialogTextHolder.sessionActive].
 *
 * Visibility / freshness: only announce when dialog text comes from nodes that are
 * [AccessibilityNodeInfo.isVisibleToUser] with on-screen bounds, in an eligible
 * window, matching a fresh event. Invisible PermissionController remnants, off-screen
 * nodes, and our own prior guidance notifications must not re-trigger camera explain.
 */
class AssistDialogAccessibilityService : AccessibilityService() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var tts: AssistTtsHelper? = null

  @Volatile
  private var lastAnnouncedFingerprint: String? = null

  @Volatile
  private var lastAnnounceAtMs: Long = 0L

  @Volatile
  private var lastAnnouncedSignature: String? = null

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

    // Drop stale / replayed events (uptime clock, same domain as eventTime).
    val eventAgeMs = SystemClock.uptimeMillis() - event.eventTime
    if (eventAgeMs < 0L || eventAgeMs > MAX_EVENT_AGE_MS) {
      return
    }

    // Debounce rapid content-change spam from the same window.
    debounceRunnable?.let { mainHandler.removeCallbacks(it) }
    val eventType = event.eventType
    val pending =
      Runnable {
        processWindow(pkg, eventType)
      }
    debounceRunnable = pending
    mainHandler.postDelayed(pending, DEBOUNCE_MS)
  }

  private fun processWindow(eventPkg: String, eventType: Int) {
    val snapshot = collectVisibleDialogSnapshot(eventPkg) ?: run {
      // Dialog gone / invisible — drop retained text so FGS cannot re-announce.
      AssistDialogTextHolder.clear()
      lastAnnouncedSignature = null
      return
    }
    val (pkg, text) = snapshot

    if (text.length < 4) {
      AssistDialogTextHolder.clear()
      return
    }

    if (looksLikeOwnGuidance(text)) {
      return
    }

    if (!isExplainWorthyDialog(pkg, text, eventType)) {
      // Active window is not a permission dialog — clear stale holder.
      AssistDialogTextHolder.clear()
      return
    }

    val detection = AssistPopupDetector.detect(text) ?: run {
      AssistDialogTextHolder.clear()
      return
    }

    // Require the live window signature to still match this detection (no stale remnant).
    val signature = dialogSignature(pkg, detection.fingerprint, text)
    if (lastAnnouncedSignature != null &&
      lastAnnouncedSignature != signature &&
      detection.fingerprint == lastAnnouncedFingerprint &&
      System.currentTimeMillis() - lastAnnounceAtMs < DEDUPE_MS
    ) {
      // Same fingerprint from a different window/text after dismiss — treat as phantom.
      AssistDialogTextHolder.clear()
      return
    }

    // Publish only when a visible dialog is confirmed (FGS OCR merge).
    AssistDialogTextHolder.publish(text)

    val now = System.currentTimeMillis()
    if (detection.fingerprint == lastAnnouncedFingerprint &&
      now - lastAnnounceAtMs < DEDUPE_MS
    ) {
      return
    }

    // Camera / launch confirmations need strong chrome unless PermissionController.
    if (!isSafeToAnnounce(pkg, detection, text)) {
      return
    }

    val step = AssistPopupExplainer.explain(detection)
    val safeDisplay = AssistSecretRedactor.forPublicText(step.displayText)
    val safeVoice = AssistSecretRedactor.forVoice(step.voiceText)

    lastAnnouncedFingerprint = detection.fingerprint
    lastAnnounceAtMs = now
    lastAnnouncedSignature = signature

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
   * Does not announce, notify, or auto-tap. Visible nodes only.
   */
  fun collectActiveWindowText(): String {
    val root = rootInActiveWindow ?: return ""
    try {
      val collected = StringBuilder()
      collectVisibleText(root, collected, depth = 0, screenBounds())
      return collected.toString().replace("\\s+".toRegex(), " ").trim()
    } finally {
      recycleQuietly(root)
    }
  }

  /**
   * Collect visible on-screen text from an eligible window that matches [eventPkg]
   * when possible. Prefers focused/active application or system dialog windows.
   */
  private fun collectVisibleDialogSnapshot(eventPkg: String): Pair<String, String>? {
    val screen = screenBounds()
    val windowList = windows
    if (!windowList.isNullOrEmpty()) {
      val ranked = windowList.sortedWith(
        compareByDescending<AccessibilityWindowInfo> { it.isFocused }
          .thenByDescending { it.isActive }
          .thenByDescending { it.layer },
      )
      var fallback: Pair<String, String>? = null
      for (window in ranked) {
        if (!isWindowEligible(window)) {
          continue
        }
        val root = window.root ?: continue
        try {
          val pkg = root.packageName?.toString().orEmpty().ifEmpty { eventPkg }
          if (pkg == packageName) {
            continue
          }
          val collected = StringBuilder()
          collectVisibleText(root, collected, depth = 0, screen)
          val text = collected.toString().replace("\\s+".toRegex(), " ").trim()
          if (text.length < 4) {
            continue
          }
          val pair = pkg to text
          // Prefer the event package (dialog that actually changed).
          if (eventPkg.isNotEmpty() && pkg.equals(eventPkg, ignoreCase = true)) {
            return pair
          }
          if (isPermissionControllerPackage(pkg) && AssistPopupDetector.detect(text) != null) {
            return pair
          }
          if (fallback == null && AssistPopupDetector.detect(text) != null) {
            fallback = pair
          }
        } finally {
          recycleQuietly(root)
        }
      }
      if (fallback != null) {
        return fallback
      }
    }

    // Fallback: active window only (still visibility-filtered).
    val root = rootInActiveWindow ?: return null
    try {
      val pkg = root.packageName?.toString().orEmpty().ifEmpty { eventPkg }
      if (pkg == packageName) {
        return null
      }
      // Event package mismatch after debounce → window already changed; avoid remnant explain.
      if (eventPkg.isNotEmpty() &&
        pkg.isNotEmpty() &&
        !pkg.equals(eventPkg, ignoreCase = true) &&
        !isPermissionControllerPackage(pkg) &&
        !isPermissionControllerPackage(eventPkg)
      ) {
        return null
      }
      val collected = StringBuilder()
      collectVisibleText(root, collected, depth = 0, screen)
      val text = collected.toString().replace("\\s+".toRegex(), " ").trim()
      if (text.length < 4) {
        return null
      }
      return pkg to text
    } finally {
      recycleQuietly(root)
    }
  }

  private fun isWindowEligible(window: AccessibilityWindowInfo): Boolean {
    // Skip non-interactive / overlay noise; keep application + system dialogs.
    val type = window.type
    if (
      type != AccessibilityWindowInfo.TYPE_APPLICATION &&
      type != AccessibilityWindowInfo.TYPE_SYSTEM &&
      type != AccessibilityWindowInfo.TYPE_INPUT_METHOD
    ) {
      return false
    }
    // Hidden / non-shown windows (API 30+ has isVisible; older rely on node visibility).
    if (android.os.Build.VERSION.SDK_INT >= 30) {
      try {
        val visibleMethod = AccessibilityWindowInfo::class.java.getMethod("isVisible")
        val visible = visibleMethod.invoke(window) as? Boolean
        if (visible == false) {
          return false
        }
      } catch (_: Exception) {
      }
    }
    val bounds = Rect()
    window.getBoundsInScreen(bounds)
    if (bounds.width() <= 0 || bounds.height() <= 0) {
      return false
    }
    val screen = screenBounds()
    if (!Rect.intersects(bounds, screen)) {
      return false
    }
    return true
  }

  /**
   * Only permission / consent / update dialogs — not home, notifications, or generic screens.
   * Do not accept com.android.systemui solely by package name.
   */
  private fun isExplainWorthyDialog(pkg: String, text: String, eventType: Int): Boolean {
    val n = text.lowercase().replace("\\s+".toRegex(), "")
    if (looksLikeOwnGuidance(text)) {
      return false
    }
    // Skip notification / QS style noise when no permission cues.
    if (looksLikeNotificationShade(n) && !hasPermissionCue(n)) {
      return false
    }
    // SystemUI: never soft-match; require strong dialog chrome (real permission sheet).
    if (pkg.contains("systemui", ignoreCase = true) &&
      !hasStrongDialogChrome(n) &&
      !isLocationPrecisionSheet(n)
    ) {
      return false
    }
    // CONTENT_CHANGED on ordinary apps: require strong chrome so settings copy
    // ("カメラへのアクセス") does not announce without a visible dialog.
    // Location precision sheets are an exception (radios, few button words).
    if (
      eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED &&
      !isPermissionControllerPackage(pkg) &&
      !hasStrongDialogChrome(n) &&
      !isLocationPrecisionSheet(n)
    ) {
      return false
    }

    if (AssistPopupDetector.detect(text) != null) {
      // Soft-body-only hits on non-controller packages need strong chrome for a11y announce.
      // Camera launch remnants without しますか / buttons must not pass.
      if (!isPermissionControllerPackage(pkg) && !hasStrongDialogChrome(n)) {
        return isLocationPrecisionSheet(n)
      }
      return true
    }
    // PermissionController package with strong topic still counts if OCR-like text is thin.
    return isPermissionControllerPackage(pkg) && hasPermissionCue(n)
  }

  private fun isLocationPrecisionSheet(n: String): Boolean {
    return (n.contains("正確な位置") && n.contains("おおよそ")) ||
      (n.contains("位置情報") &&
        (n.contains("正確") ||
          n.contains("おおよそ") ||
          n.contains("常に許可") ||
          n.contains("アプリの使用中") ||
          n.contains("今回のみ") ||
          n.contains("許可しない")))
  }

  /**
   * Camera (and similar) must not speak unless UI chrome is present or controller hosts it.
   */
  private fun isSafeToAnnounce(
    pkg: String,
    detection: AssistPopupDetector.Detection,
    text: String,
  ): Boolean {
    val n = text.lowercase().replace("\\s+".toRegex(), "")
    if (isPermissionControllerPackage(pkg)) {
      return true
    }
    if (hasStrongDialogChrome(n)) {
      return true
    }
    // Location precision sheets can lack 「許可」 buttons in OCR/a11y.
    if (detection.kind == AssistPopupDetector.PopupKind.PERMISSION_LOCATION &&
      ((n.contains("正確な位置") && n.contains("おおよそ")) || n.contains("位置情報"))
    ) {
      return true
    }
    // Camera / mic / launch confirmations: never announce from soft partial text alone.
    return when (detection.kind) {
      AssistPopupDetector.PopupKind.PERMISSION_CAMERA,
      AssistPopupDetector.PopupKind.PERMISSION_MIC,
      -> false
      else -> AssistPopupDetector.detect(text) != null
    }
  }

  private fun hasStrongDialogChrome(n: String): Boolean {
    val question =
      n.contains("しますか") ||
        n.contains("よろしいですか") ||
        n.contains("いいですか") ||
        n.contains("？") ||
        n.contains("?")
    val buttons =
      n.contains("許可しない") ||
        n.contains("拒否") ||
        n.contains("一度だけ") ||
        n.contains("今回のみ") ||
        n.contains("アプリの使用中") ||
        n.contains("許可する") ||
        n.contains("常に許可") ||
        n.contains("don'tallow") ||
        n.contains("dontallow") ||
        n.contains("whileusingtheapp") ||
        n.contains("onlythistime")
    return question || buttons
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

  /** Prior notify/TTS copy must not be re-read as a live permission dialog. */
  private fun looksLikeOwnGuidance(text: String): Boolean {
    val n = text.lowercase().replace("\\s+".toRegex(), "")
    return n.contains("聞いている画面です") ||
      n.contains("代わりに押しません") ||
      n.contains("よりそいai") ||
      n.contains("断定はしません") ||
      n.contains("自分の目で確認してください")
  }

  private fun isPermissionControllerPackage(pkg: String): Boolean {
    return pkg.contains("permissioncontroller", ignoreCase = true) ||
      pkg.contains("android.permission", ignoreCase = true) ||
      pkg.contains("com.google.android.permissionutil", ignoreCase = true)
  }

  private fun dialogSignature(pkg: String, fingerprint: String, text: String): String {
    val clip = text.take(80)
    return listOf(pkg, fingerprint, clip).joinToString("|")
  }

  private fun screenBounds(): Rect {
    val dm = resources.displayMetrics
    return Rect(0, 0, dm.widthPixels, dm.heightPixels)
  }

  /**
   * Collect text only from nodes the user can actually see on screen now.
   * Skips invisible, zero-size, and off-screen remnants (common after dismiss).
   */
  private fun collectVisibleText(
    node: AccessibilityNodeInfo?,
    out: StringBuilder,
    depth: Int,
    screen: Rect,
  ) {
    if (node == null || depth > 24) {
      return
    }
    val bounds = Rect()
    node.getBoundsInScreen(bounds)
    val onScreen =
      bounds.width() > 0 &&
        bounds.height() > 0 &&
        Rect.intersects(bounds, screen)
    val visible = node.isVisibleToUser && onScreen

    if (visible) {
      val own = node.text?.toString()?.trim().orEmpty()
      val desc = node.contentDescription?.toString()?.trim().orEmpty()
      if (own.isNotEmpty()) {
        if (out.isNotEmpty()) out.append(' ')
        out.append(own)
      } else if (desc.isNotEmpty()) {
        if (out.isNotEmpty()) out.append(' ')
        out.append(desc)
      }
    }

    // Still walk children: some parents mis-report visibility while children are shown.
    for (i in 0 until node.childCount) {
      val child = node.getChild(i) ?: continue
      try {
        collectVisibleText(child, out, depth + 1, screen)
      } finally {
        recycleQuietly(child)
      }
    }
  }

  private fun recycleQuietly(node: AccessibilityNodeInfo?) {
    if (node == null) return
    try {
      node.recycle()
    } catch (_: Exception) {
    }
  }

  companion object {
    private const val DEBOUNCE_MS = 600L
    private const val DEDUPE_MS = 45_000L
    /** Drop events older than this (debounce + brief UI settle). */
    private const val MAX_EVENT_AGE_MS = 3_000L

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
