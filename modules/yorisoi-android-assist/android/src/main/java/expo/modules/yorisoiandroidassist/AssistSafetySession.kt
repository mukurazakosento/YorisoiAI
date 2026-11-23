package expo.modules.yorisoiandroidassist

/**
 * Arms a one-shot safety screen read (phone / email) after the user chose a mode.
 * Does not enable continuous mass-reading. Always-on popup explain stays independent.
 */
object AssistSafetySession {
  @Volatile
  private var mode: String? = null

  @Volatile
  private var armedAtMs: Long = 0L

  /** mode: "phone" | "email" */
  fun arm(mode: String) {
    val normalized = mode.trim().lowercase()
    if (normalized != "phone" && normalized != "email") {
      return
    }
    this.mode = normalized
    armedAtMs = System.currentTimeMillis()
  }

  fun disarm() {
    mode = null
    armedAtMs = 0L
  }

  fun isArmed(maxAgeMs: Long = 10 * 60_000L): Boolean {
    val m = mode ?: return false
    if (m != "phone" && m != "email") {
      return false
    }
    val age = System.currentTimeMillis() - armedAtMs
    if (age < 0 || age > maxAgeMs) {
      return false
    }
    return true
  }

  fun currentMode(): String {
    return if (isArmed()) mode.orEmpty() else ""
  }
}
