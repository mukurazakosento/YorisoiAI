package expo.modules.yorisoiondevicellm

import android.content.Context
import android.content.SharedPreferences
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import java.util.concurrent.atomic.AtomicBoolean

/**
 * MediaPipe GenAI wrapper. Ready only after probe inference succeeds.
 * Never accepts image bytes — text prompts only.
 */
object OnDeviceLlmEngine {
  private val lock = Any()
  private var inference: LlmInference? = null
  private var prefs: SharedPreferences? = null
  private var downloader: LlmModelDownloader? = null
  private val probeOk = AtomicBoolean(false)

  @Volatile
  var lastError: String? = null
    private set

  fun init(context: Context) {
    synchronized(lock) {
      if (prefs == null) {
        prefs = context.applicationContext.getSharedPreferences("yorisoi_on_device_llm", Context.MODE_PRIVATE)
      }
      if (downloader == null) {
        downloader = LlmModelDownloader(context.applicationContext)
      }
    }
  }

  fun hasConsent(): Boolean = prefs?.getBoolean("model_download_consent", false) == true

  fun setConsent(accepted: Boolean) {
    prefs?.edit()?.putBoolean("model_download_consent", accepted)?.apply()
  }

  fun modelPath(): String? {
    val d = downloader ?: return null
    return if (d.hasValidModelFile()) d.modelFile().absolutePath else null
  }

  fun storageOk(): Boolean = downloader?.enoughStorage() == true

  fun freeBytes(): Long = downloader?.freeBytes() ?: 0L

  fun isDownloading(): Boolean = downloader?.isRunning() == true

  fun isReady(): Boolean = synchronized(lock) { inference != null && probeOk.get() }

  fun statusMap(): Map<String, Any?> {
    val d = downloader
    return mapOf(
      "engine" to LlmModelCatalog.ENGINE_NAME,
      "modelId" to LlmModelCatalog.MODEL_ID,
      "displayName" to LlmModelCatalog.DISPLAY_NAME,
      "license" to LlmModelCatalog.LICENSE_NAME,
      "licenseUrl" to LlmModelCatalog.LICENSE_URL,
      "approxBytes" to LlmModelCatalog.APPROX_BYTES,
      "hasConsent" to hasConsent(),
      "modelPresent" to (d?.hasValidModelFile() == true),
      "modelPath" to (modelPath() ?: ""),
      "ready" to isReady(),
      "downloading" to isDownloading(),
      "storageOk" to storageOk(),
      "freeBytes" to freeBytes(),
      "lastError" to (lastError ?: ""),
      "probeVerified" to probeOk.get(),
    )
  }

  fun startDownload(
    url: String?,
    onProgress: (Map<String, Any?>) -> Unit,
    onDone: (Result<String>) -> Unit,
  ) {
    val d = downloader
    if (d == null) {
      onDone(Result.failure(IllegalStateException("初期化されていません。")))
      return
    }
    if (!hasConsent()) {
      onDone(
        Result.failure(
          IllegalStateException(
            "モデル取得の説明に同意してからダウンロードしてください。",
          ),
        ),
      )
      return
    }
    val target = url?.takeIf { it.isNotBlank() } ?: LlmModelCatalog.DEFAULT_DOWNLOAD_URL
    d.start(
      url = target,
      onProgress = { p ->
        onProgress(
          mapOf(
            "bytesDownloaded" to p.bytesDownloaded,
            "totalBytes" to p.totalBytes,
            "fraction" to p.fraction,
            "phase" to p.phase,
          ),
        )
      },
      onDone = { result ->
        result.fold(
          onSuccess = { file -> onDone(Result.success(file.absolutePath)) },
          onFailure = { err ->
            lastError = err.message
            onDone(Result.failure(err))
          },
        )
      },
    )
  }

  fun cancelDownload() {
    downloader?.cancel()
  }

  fun deleteCorruptModel() {
    synchronized(lock) {
      unloadLocked()
      downloader?.modelFile()?.delete()
      downloader?.partialFile()?.delete()
      probeOk.set(false)
    }
  }

  /**
   * Load model and run a tiny probe. Ready only if probe returns non-empty text.
   */
  fun loadAndProbe(context: Context): Result<String> {
    synchronized(lock) {
      try {
        init(context)
        val path = modelPath()
          ?: return Result.failure(
            IllegalStateException("モデルファイルがありません。先にダウンロードしてください。"),
          )
        unloadLocked()
        val options =
          LlmInference.LlmInferenceOptions.builder()
            .setModelPath(path)
            .setMaxTokens(256)
            .build()
        val created = LlmInference.createFromOptions(context.applicationContext, options)
        inference = created
        val probe = created.generateResponse("Reply with exactly: OK")
        val trimmed = probe.trim()
        if (trimmed.isEmpty()) {
          unloadLocked()
          lastError = "プローブ推論が空でした。"
          return Result.failure(IllegalStateException(lastError))
        }
        probeOk.set(true)
        lastError = null
        return Result.success(trimmed.take(80))
      } catch (e: Exception) {
        lastError = e.message ?: "モデル読み込みに失敗しました。"
        // Corrupt file → allow re-download
        if (lastError!!.contains("model", ignoreCase = true) ||
          lastError!!.contains("file", ignoreCase = true) ||
          lastError!!.contains("task", ignoreCase = true)
        ) {
          try {
            downloader?.modelFile()?.delete()
          } catch (_: Exception) {
          }
        }
        unloadLocked()
        return Result.failure(e)
      }
    }
  }

  /** 1-arg signature required for AssistLlmBridge reflection (`generate(String)`). */
  fun generate(prompt: String): Result<String> {
    synchronized(lock) {
      val eng = inference
      if (eng == null || !probeOk.get()) {
        return Result.failure(IllegalStateException("端末内AIは未準備です（AI未接続）。"))
      }
      return try {
        val safe = LlmSecretRedactor.redact(prompt)
        // MediaPipe maxTokens comes from LlmInferenceOptions; keep prompt-only text path.
        val out = eng.generateResponse(safe)
        Result.success(out.trim())
      } catch (e: Exception) {
        lastError = e.message
        Result.failure(e)
      }
    }
  }

  fun unload() {
    synchronized(lock) {
      unloadLocked()
    }
  }

  private fun unloadLocked() {
    try {
      inference?.close()
    } catch (_: Exception) {
    }
    inference = null
    probeOk.set(false)
  }
}
