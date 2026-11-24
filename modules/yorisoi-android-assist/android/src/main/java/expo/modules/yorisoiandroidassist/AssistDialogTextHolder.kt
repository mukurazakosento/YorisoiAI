package expo.modules.yorisoiandroidassist

/**
 * Latest dialog-like text from [AssistDialogAccessibilityService].
 * Always-on a11y may publish without a MediaProjection session.
 * [sessionActive] is only used by FGS to know an assist capture loop is running
 * (optional OCR merge); it does **not** gate a11y event processing.
 * Text only; not persisted; no network.
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
    // Do not clear text when FGS stops — always-on a11y may still be explaining.
  }

  fun publish(text: String) {
    val trimmed = text.replace("\\s+".toRegex(), " ").trim()
    if (trimmed.length < 4) {
      return
    }
    latestText = trimmed
    latestAtMs = System.currentTimeMillis()
  }

  /**
   * Return recent dialog text if fresh (default 5s), else empty.
   * Short TTL avoids FGS re-announcing a dismissed camera/permission sheet
   * from retained a11y text. Available regardless of sessionActive.
   */
  fun peekRecent(maxAgeMs: Long = 5_000L): String {
    val age = System.currentTimeMillis() - latestAtMs
    if (age < 0 || age > maxAgeMs) {
      if (age > maxAgeMs) {
        clear()
      }
      return ""
    }
    return latestText
  }

  fun clear() {
    latestText = ""
    latestAtMs = 0L
  }
}
