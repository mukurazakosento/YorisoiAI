package expo.modules.yorisoiandroidassist

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Android TextToSpeech for guidance while the app may be backgrounded.
 * Speaks Japanese when available; failures are silent (caller keeps notification text).
 */
class AssistTtsHelper(context: Context) : TextToSpeech.OnInitListener {
  private val ready = AtomicBoolean(false)
  private var tts: TextToSpeech? = TextToSpeech(context.applicationContext, this)
  private var enabled: Boolean = true

  override fun onInit(status: Int) {
    if (status != TextToSpeech.SUCCESS) {
      ready.set(false)
      return
    }
    val engine = tts ?: return
    val result = engine.setLanguage(Locale.JAPANESE)
    ready.set(
      result != TextToSpeech.LANG_MISSING_DATA &&
        result != TextToSpeech.LANG_NOT_SUPPORTED,
    )
  }

  fun setEnabled(value: Boolean) {
    enabled = value
    if (!value) {
      stop()
    }
  }

  fun speak(text: String) {
    if (!enabled || text.isBlank()) {
      return
    }
    val engine = tts ?: return
    if (!ready.get()) {
      return
    }
    engine.stop()
    engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "yorisoi-assist")
  }

  fun stop() {
    try {
      tts?.stop()
    } catch (_: Exception) {
      // no-op
    }
  }

  fun shutdown() {
    stop()
    try {
      tts?.shutdown()
    } catch (_: Exception) {
      // no-op
    }
    tts = null
    ready.set(false)
  }
}
