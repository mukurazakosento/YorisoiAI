package expo.modules.yorisoiandroidassist

/**
 * Latest dialog-like text from the optional AccessibilityService.
 * Cleared when assist session stops. No images; text only.
 */
object AssistDialogTextHolder {
  @Volatile
  var sessionActive: Boolean = false
    private set

  @Volatile
  private var latestText: String = ""

  @Volatile
  private var latestAtMs: Long = 0L

  fun setSessionActive(active: Boolean) {
    sessionActive = active
    if (!active) {
      clear()
    }
  }

  fun publish(text: String) {
    if (!sessionActive) {
      return
    }
    val trimmed = text.replace("\\s+".toRegex(), " ").trim()
    if (trimmed.length < 4) {
      return
    }
    latestText = trimmed
    latestAtMs = System.currentTimeMillis()
  }

  /**
   * Return recent dialog text if fresh (default 15s), else empty.
   */
  fun peekRecent(maxAgeMs: Long = 15_000L): String {
    if (!sessionActive) {
      return ""
    }
    val age = System.currentTimeMillis() - latestAtMs
    if (age < 0 || age > maxAgeMs) {
      return ""
    }
    return latestText
  }

  fun clear() {
    latestText = ""
    latestAtMs = 0L
  }
}
