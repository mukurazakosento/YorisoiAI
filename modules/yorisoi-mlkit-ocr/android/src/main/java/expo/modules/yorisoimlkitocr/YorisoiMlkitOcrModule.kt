package expo.modules.yorisoimlkitocr

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

/**
 * Android stub — Japanese ML Kit will be swapped in later.
 * Never pretends OCR succeeded; never uploads image bytes.
 */
class YorisoiMlkitOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("YorisoiMlkitOcr")

    Function("isAvailable") {
      false
    }

    AsyncFunction("recognizeText") { _: String, promise: Promise ->
      promise.reject(
        "OCR_ANDROID_NOT_READY",
        "Android 向けの文字認識はこれから用意します。画像は外部へ送っていません。",
        null
      )
    }
  }
}
