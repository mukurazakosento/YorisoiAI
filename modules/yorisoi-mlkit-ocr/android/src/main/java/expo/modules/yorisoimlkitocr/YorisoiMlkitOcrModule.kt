package expo.modules.yorisoimlkitocr

import android.graphics.BitmapFactory
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

/**
 * On-device OCR using Google ML Kit Text Recognition v2 (Japanese), bundled model.
 * Image bytes are processed locally only — never uploaded by this module.
 * Result shape matches the iOS module (text / blocks / lines / elements / engine).
 */
class YorisoiMlkitOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("YorisoiMlkitOcr")

    Function("isAvailable") {
      true
    }

    AsyncFunction("recognizeText") { uriString: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject(
          "OCR_NO_CONTEXT",
          "アプリの準備が整っていません。もう一度お試しください。画像は外部へ送っていません。",
          null
        )
        return@AsyncFunction
      }

      val uri = resolveUri(uriString)
      if (uri == null) {
        promise.reject("INVALID_URI", "画像の場所が正しくありません: $uriString", null)
        return@AsyncFunction
      }

      var copiedTemp: File? = null
      try {
        val image = loadInputImage(context, uri) { temp ->
          copiedTemp = temp
        }
        if (image == null) {
          promise.reject(
            "IMAGE_LOAD_FAILED",
            "画像を読み込めませんでした。別のスクリーンショットを選んでください。",
            null
          )
          return@AsyncFunction
        }

        val options = JapaneseTextRecognizerOptions.Builder().build()
        val recognizer = TextRecognition.getClient(options)

        recognizer.process(image)
          .addOnSuccessListener { result ->
            try {
              promise.resolve(mapResult(result))
            } finally {
              deleteQuietly(copiedTemp)
            }
          }
          .addOnFailureListener { error ->
            deleteQuietly(copiedTemp)
            promise.reject(
              "RECOGNITION_FAILED",
              "文字を読み取れませんでした: ${error.localizedMessage ?: error.message ?: "不明なエラー"}",
              error
            )
          }
      } catch (error: Exception) {
        deleteQuietly(copiedTemp)
        promise.reject(
          "RECOGNITION_FAILED",
          "文字を読み取れませんでした: ${error.localizedMessage ?: error.message ?: "不明なエラー"}",
          error
        )
      }
    }
  }

  private fun resolveUri(uriString: String): Uri? {
    if (uriString.isBlank()) {
      return null
    }
    if (uriString.startsWith("content://") || uriString.startsWith("file://")) {
      return Uri.parse(uriString)
    }
    if (uriString.startsWith("/")) {
      return Uri.fromFile(File(uriString))
    }
    return Uri.parse(uriString)
  }

  /**
   * Prefer ML Kit fromFilePath for file:// and content://.
   * If that fails (rare content providers), copy bytes to a cache temp file then delete after OCR.
   */
  private fun loadInputImage(
    context: android.content.Context,
    uri: Uri,
    onCopiedTemp: (File) -> Unit,
  ): InputImage? {
    try {
      return InputImage.fromFilePath(context, uri)
    } catch (_: Exception) {
      // fall through to explicit decode / copy
    }

    return try {
      when (uri.scheme) {
        "content" -> {
          context.contentResolver.openInputStream(uri)?.use { input ->
            val temp = File.createTempFile("yorisoi-ocr-", ".img", context.cacheDir)
            FileOutputStream(temp).use { output ->
              input.copyTo(output)
            }
            onCopiedTemp(temp)
            InputImage.fromFilePath(context, Uri.fromFile(temp))
          }
        }
        "file", null -> {
          val path = uri.path ?: return null
          val file = File(path)
          if (!file.exists()) {
            return null
          }
          val bitmap = BitmapFactory.decodeFile(path) ?: return null
          InputImage.fromBitmap(bitmap, 0)
        }
        else -> null
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun mapResult(result: Text): Map<String, Any> {
    val blocks = result.textBlocks.map { block ->
      val lines = block.lines.map { line ->
        val elements = line.elements.map { element ->
          mapOf(
            "text" to element.text,
            "boundingBox" to boxDict(element.boundingBox)
          )
        }
        mapOf(
          "text" to line.text,
          "boundingBox" to boxDict(line.boundingBox),
          "elements" to elements
        )
      }
      mapOf(
        "text" to block.text,
        "boundingBox" to boxDict(block.boundingBox),
        "lines" to lines
      )
    }

    return mapOf(
      "text" to result.text,
      "blocks" to blocks,
      "engine" to "mlkit-japanese"
    )
  }

  private fun boxDict(rect: android.graphics.Rect?): Map<String, Double> {
    if (rect == null) {
      return mapOf("x" to 0.0, "y" to 0.0, "width" to 0.0, "height" to 0.0)
    }
    return mapOf(
      "x" to rect.left.toDouble(),
      "y" to rect.top.toDouble(),
      "width" to rect.width().toDouble(),
      "height" to rect.height().toDouble()
    )
  }

  private fun deleteQuietly(file: File?) {
    if (file == null) {
      return
    }
    try {
      if (file.exists()) {
        file.delete()
      }
    } catch (_: Exception) {
      // best-effort; image never left the device
    }
  }
}
