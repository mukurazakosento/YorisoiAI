package expo.modules.yorisoiandroidassist

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Optional dialog-text reader for system permission sheets.
 * Active only while [AssistDialogTextHolder.sessionActive] (user-started assist).
 * Never clicks / gestures. Not silent monitoring outside a session.
 */
class AssistDialogAccessibilityService : AccessibilityService() {
  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null || !AssistDialogTextHolder.sessionActive) {
      return
    }
    if (
      event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
      event.eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
    ) {
      return
    }

    val pkg = event.packageName?.toString().orEmpty()
    val root = rootInActiveWindow ?: event.source ?: return
    try {
      val collected = StringBuilder()
      collectText(root, collected, depth = 0)
      val text = collected.toString().replace("\\s+".toRegex(), " ").trim()
      if (text.length < 4) {
        return
      }
      // Prefer permission-controller / dialog-like trees; still accept if detector would match.
      val likelySystemPermission =
        pkg.contains("permissioncontroller", ignoreCase = true) ||
          pkg.contains("android.permission", ignoreCase = true) ||
          pkg == "com.android.systemui" ||
          AssistPopupDetector.detect(text) != null ||
          looksLikePermissionUi(text)
      if (likelySystemPermission) {
        AssistDialogTextHolder.publish(text)
      }
    } finally {
      try {
        root.recycle()
      } catch (_: Exception) {
      }
    }
  }

  override fun onInterrupt() {
    // no-op
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
  }

  private fun looksLikePermissionUi(text: String): Boolean {
    val n = text.lowercase().replace("\\s+".toRegex(), "")
    return n.contains("位置") ||
      n.contains("カメラ") ||
      n.contains("マイク") ||
      n.contains("通知") ||
      n.contains("許可しない") ||
      n.contains("don'tallow") ||
      n.contains("whileusing") ||
      (n.contains("正確な位置") && n.contains("おおよそ"))
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
}
