package expo.modules.yorisoiandroidassist

import android.graphics.Bitmap
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * On-device Japanese OCR via the same ML Kit library family as yorisoi-mlkit-ocr.
 * Not a second Expo OCR module — direct library call inside the assist service.
 * Bitmap bytes never leave the device.
 */
object AssistOcrHelper {
  private val recognizer by lazy {
    TextRecognition.getClient(JapaneseTextRecognizerOptions.Builder().build())
  }

  fun recognizeJapanese(bitmap: Bitmap): String {
    val image = InputImage.fromBitmap(bitmap, 0)
    val latch = CountDownLatch(1)
    val holder = AtomicReference<String>("")
    val error = AtomicReference<Exception?>(null)

    recognizer
      .process(image)
      .addOnSuccessListener { result ->
        holder.set(result.text?.trim().orEmpty())
        latch.countDown()
      }
      .addOnFailureListener { e ->
        error.set(e)
        latch.countDown()
      }

    val completed = latch.await(12, TimeUnit.SECONDS)
    if (!completed) {
      throw IllegalStateException("OCR timed out")
    }
    error.get()?.let { throw it }
    return holder.get()
  }
}
