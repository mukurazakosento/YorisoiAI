package expo.modules.yorisoiandroidassist

import android.content.Context
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Serial Android TTS: never overlap utterances.
 * While speaking, newer requests replace a single pending slot; after the current
 * utterance ends, only the **latest** pending text is spoken once.
 * Same text as current/pending/last-spoken is ignored (no thrash).
 */
class AssistTtsHelper(context: Context) : TextToSpeech.OnInitListener {
  private val ready = AtomicBoolean(false)
  private var tts: TextToSpeech? = TextToSpeech(context.applicationContext, this)
  private var enabled: Boolean = true
  private val mainHandler = Handler(Looper.getMainLooper())

  @Volatile
  private var speaking: Boolean = false

  @Volatile
  private var currentText: String? = null

  /** At most one pending utterance (latest wins). */
  @Volatile
  private var pendingText: String? = null

  @Volatile
  private var lastSpokenText: String? = null

  private val utteranceListener = object : UtteranceProgressListener() {
    override fun onStart(utteranceId: String?) {
      speaking = true
    }

    override fun onDone(utteranceId: String?) {
      mainHandler.post { onUtteranceFinished() }
    }

    @Deprecated("Deprecated in Java")
    override fun onError(utteranceId: String?) {
      mainHandler.post { onUtteranceFinished() }
    }

    override fun onError(utteranceId: String?, errorCode: Int) {
      mainHandler.post { onUtteranceFinished() }
    }
  }

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
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.ICE_CREAM_SANDWICH_MR1) {
      engine.setOnUtteranceProgressListener(utteranceListener)
    }
  }

  fun setEnabled(value: Boolean) {
    enabled = value
    if (!value) {
      stop()
    }
  }

  /**
   * Request speech of [text]. Does not interrupt the current utterance.
   * Dropped if identical to current, pending, or just-spoken content.
   */
  fun speakLatest(text: String) {
    if (!enabled || text.isBlank()) {
      return
    }
    val engine = tts ?: return
    if (!ready.get()) {
      return
    }
    val trimmed = text.trim()
    if (trimmed == currentText || trimmed == pendingText) {
      return
    }
    if (speaking) {
      // Drop older queued item; keep only latest for after current ends.
      pendingText = trimmed
      return
    }
    if (trimmed == lastSpokenText && pendingText == null) {
      // Same as last finished line and nothing new pending — skip repeat.
      return
    }
    startSpeak(engine, trimmed)
  }

  /** @deprecated Prefer [speakLatest]. Kept as alias for call sites. */
  fun speak(text: String) {
    speakLatest(text)
  }

  fun stop() {
    pendingText = null
    currentText = null
    speaking = false
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

  private fun onUtteranceFinished() {
    val finished = currentText
    if (finished != null) {
      lastSpokenText = finished
    }
    currentText = null
    speaking = false
    val next = pendingText
    pendingText = null
    if (!enabled || next.isNullOrBlank()) {
      return
    }
    if (next == lastSpokenText) {
      return
    }
    val engine = tts ?: return
    if (!ready.get()) {
      return
    }
    startSpeak(engine, next)
  }

  private fun startSpeak(engine: TextToSpeech, text: String) {
    currentText = text
    speaking = true
    val params = Bundle()
    val uttered = engine.speak(text, TextToSpeech.QUEUE_FLUSH, params, "yorisoi-assist")
    if (uttered != TextToSpeech.SUCCESS) {
      speaking = false
      currentText = null
    }
  }
}
