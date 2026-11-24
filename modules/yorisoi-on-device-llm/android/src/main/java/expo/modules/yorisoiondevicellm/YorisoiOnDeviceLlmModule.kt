package expo.modules.yorisoiondevicellm

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import java.util.concurrent.Executors

/**
 * Expo bridge for on-device MediaPipe LLM.
 * Text prompts only — never accepts image / screenshot bytes.
 */
class YorisoiOnDeviceLlmModule : Module() {
  private val io = Executors.newSingleThreadExecutor()

  override fun definition() = ModuleDefinition {
    Name("YorisoiOnDeviceLlm")

    Events("onDownloadProgress")

    OnCreate {
      val ctx = appContext.reactContext
      if (ctx != null) {
        OnDeviceLlmEngine.init(ctx)
      }
    }

    Function("isSupported") {
      appContext.reactContext != null
    }

    Function("getStatus") {
      val ctx = appContext.reactContext
      if (ctx != null) {
        OnDeviceLlmEngine.init(ctx)
      }
      OnDeviceLlmEngine.statusMap()
    }

    Function("setDownloadConsent") { accepted: Boolean ->
      val ctx = appContext.reactContext
        ?: return@Function mapOf("ok" to false, "error" to "NO_CONTEXT")
      OnDeviceLlmEngine.init(ctx)
      OnDeviceLlmEngine.setConsent(accepted)
      mapOf("ok" to true, "hasConsent" to OnDeviceLlmEngine.hasConsent())
    }

    AsyncFunction("startDownload") { options: Map<String, Any?>?, promise: Promise ->
      val ctx = appContext.reactContext
      if (ctx == null) {
        promise.reject("NO_CONTEXT", "アプリの準備が整っていません。", null)
        return@AsyncFunction
      }
      OnDeviceLlmEngine.init(ctx)
      val url = options?.get("url") as? String
      io.execute {
        OnDeviceLlmEngine.startDownload(
          url = url,
          onProgress = { progress ->
            sendEvent("onDownloadProgress", progress)
          },
          onDone = { result ->
            result.fold(
              onSuccess = { path ->
                promise.resolve(
                  mapOf(
                    "ok" to true,
                    "path" to path,
                    "modelId" to LlmModelCatalog.MODEL_ID,
                  ),
                )
              },
              onFailure = { err ->
                promise.reject(
                  "DOWNLOAD_FAILED",
                  err.message ?: "ダウンロードに失敗しました。",
                  err,
                )
              },
            )
          },
        )
      }
    }

    Function("cancelDownload") {
      OnDeviceLlmEngine.cancelDownload()
      mapOf("ok" to true)
    }

    Function("deleteModel") {
      OnDeviceLlmEngine.deleteCorruptModel()
      mapOf("ok" to true)
    }

    AsyncFunction("loadModel") { promise: Promise ->
      val ctx = appContext.reactContext
      if (ctx == null) {
        promise.reject("NO_CONTEXT", "アプリの準備が整っていません。", null)
        return@AsyncFunction
      }
      io.execute {
        val result = OnDeviceLlmEngine.loadAndProbe(ctx)
        result.fold(
          onSuccess = { probe ->
            promise.resolve(
              mapOf(
                "ok" to true,
                "ready" to true,
                "probe" to probe,
                "modelId" to LlmModelCatalog.MODEL_ID,
                "engine" to LlmModelCatalog.ENGINE_NAME,
              ),
            )
          },
          onFailure = { err ->
            promise.reject(
              "LOAD_FAILED",
              err.message ?: "モデルを読み込めませんでした（AI未接続）。",
              err,
            )
          },
        )
      }
    }

    Function("unloadModel") {
      OnDeviceLlmEngine.unload()
      mapOf("ok" to true, "ready" to false)
    }

    AsyncFunction("generate") { prompt: String, promise: Promise ->
      if (prompt.isBlank()) {
        promise.reject("EMPTY_PROMPT", "入力が空です。", null)
        return@AsyncFunction
      }
      // Reject obvious image payloads — text only.
      if (prompt.contains("data:image", ignoreCase = true) ||
        prompt.contains("imageBase64", ignoreCase = true) ||
        prompt.contains("screenshotBytes", ignoreCase = true)
      ) {
        promise.reject(
          "IMAGE_REJECTED",
          "画像は端末内AIに渡しません。文字のみです。",
          null,
        )
        return@AsyncFunction
      }
      io.execute {
        val result = OnDeviceLlmEngine.generate(prompt)
        result.fold(
          onSuccess = { text -> promise.resolve(mapOf("text" to text)) },
          onFailure = { err ->
            promise.reject(
              "GENERATE_FAILED",
              err.message ?: "推論に失敗しました（AI未接続）。",
              err,
            )
          },
        )
      }
    }
  }
}
