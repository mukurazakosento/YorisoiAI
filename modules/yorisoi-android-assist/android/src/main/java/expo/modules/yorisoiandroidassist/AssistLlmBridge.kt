package expo.modules.yorisoiandroidassist

/**
 * Optional bridge to [expo.modules.yorisoiondevicellm.OnDeviceLlmEngine] via reflection.
 * Avoids a hard Gradle dependency while allowing FGS to use real on-device inference
 * when the LLM module is linked and probe-verified.
 *
 * Never fabricates ready=true. Never passes images.
 */
object AssistLlmBridge {
  @Volatile
  private var engineClass: Class<*>? = null

  @Volatile
  private var engineInstance: Any? = null

  private fun resolve(): Any? {
    engineInstance?.let { return it }
    return try {
      val clazz = Class.forName("expo.modules.yorisoiondevicellm.OnDeviceLlmEngine")
      val instance = clazz.getField("INSTANCE").get(null)
      engineClass = clazz
      engineInstance = instance
      instance
    } catch (_: Throwable) {
      null
    }
  }

  fun isReady(): Boolean {
    val eng = resolve() ?: return false
    return try {
      eng.javaClass.getMethod("isReady").invoke(eng) as? Boolean == true
    } catch (_: Throwable) {
      false
    }
  }

  fun generate(prompt: String): String? {
    if (prompt.isBlank()) return null
    if (
      prompt.contains("data:image", ignoreCase = true) ||
      prompt.contains("imageBase64", ignoreCase = true) ||
      prompt.contains("screenshotBytes", ignoreCase = true)
    ) {
      return null
    }
    val eng = resolve() ?: return null
    if (!isReady()) return null
    return try {
      @Suppress("UNCHECKED_CAST")
      val result = eng.javaClass.getMethod("generate", String::class.java).invoke(eng, prompt)
      // Kotlin Result
      val isSuccess = result.javaClass.getMethod("isSuccess").invoke(result) as Boolean
      if (!isSuccess) return null
      result.javaClass.getMethod("getOrNull").invoke(result) as? String
    } catch (_: Throwable) {
      null
    }
  }
}
