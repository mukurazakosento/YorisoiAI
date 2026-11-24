package expo.modules.yorisoiondevicellm

import android.content.Context
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

/**
 * Resume-capable HTTP download for the on-device model file.
 * Requires prior user consent. Checks free space. Re-downloads corrupt files.
 */
class LlmModelDownloader(private val context: Context) {
  data class Progress(
    val bytesDownloaded: Long,
    val totalBytes: Long,
    val fraction: Double,
    val phase: String,
  )

  private val cancelFlag = AtomicBoolean(false)
  @Volatile
  private var worker: Thread? = null

  fun modelFile(): File {
    val dir = File(context.filesDir, "on-device-llm")
    if (!dir.exists()) {
      dir.mkdirs()
    }
    return File(dir, LlmModelCatalog.FILE_NAME)
  }

  fun partialFile(): File = File(modelFile().absolutePath + ".partial")

  fun hasValidModelFile(): Boolean {
    val f = modelFile()
    return f.isFile && f.length() >= LlmModelCatalog.MIN_VALID_BYTES
  }

  fun freeBytes(): Long {
    return try {
      context.filesDir.usableSpace
    } catch (_: Exception) {
      0L
    }
  }

  fun enoughStorage(needed: Long = LlmModelCatalog.APPROX_BYTES): Boolean {
    // Keep ~100 MB headroom.
    return freeBytes() >= needed + 100L * 1024L * 1024L
  }

  fun cancel() {
    cancelFlag.set(true)
  }

  fun isRunning(): Boolean = worker?.isAlive == true

  fun start(
    url: String = LlmModelCatalog.DEFAULT_DOWNLOAD_URL,
    onProgress: (Progress) -> Unit,
    onDone: (Result<File>) -> Unit,
  ) {
    if (isRunning()) {
      onDone(Result.failure(IllegalStateException("すでにダウンロード中です。")))
      return
    }
    cancelFlag.set(false)
    worker =
      thread(name = "yorisoi-llm-download", isDaemon = true) {
        try {
          val result = downloadBlocking(url, onProgress)
          onDone(result)
        } catch (e: Exception) {
          onDone(Result.failure(e))
        }
      }
  }

  private fun downloadBlocking(
    url: String,
    onProgress: (Progress) -> Unit,
  ): Result<File> {
    if (!enoughStorage()) {
      return Result.failure(
        IllegalStateException(
          "空き容量が足りません（モデル約550MB＋余裕が必要です）。",
        ),
      )
    }

    val dest = modelFile()
    val partial = partialFile()
    if (hasValidModelFile()) {
      onProgress(Progress(dest.length(), dest.length(), 1.0, "already_present"))
      return Result.success(dest)
    }

    var existing = 0L
    if (partial.exists()) {
      existing = partial.length()
    }

    val connection = (URL(url).openConnection() as HttpURLConnection).apply {
      instanceFollowRedirects = true
      connectTimeout = 30_000
      readTimeout = 60_000
      requestMethod = "GET"
      if (existing > 0) {
        setRequestProperty("Range", "bytes=$existing-")
      }
    }

    try {
      connection.connect()
      val code = connection.responseCode
      if (code !in 200..299 && code != 206) {
        return Result.failure(
          IllegalStateException("ダウンロードに失敗しました（HTTP $code）。"),
        )
      }

      val totalFromHeader =
        when {
          code == 206 -> {
            val range = connection.getHeaderField("Content-Range")
            val totalPart = range?.substringAfter('/')?.toLongOrNull()
            totalPart ?: (existing + connection.contentLengthLong.coerceAtLeast(0L))
          }
          connection.contentLengthLong > 0 -> connection.contentLengthLong
          else -> LlmModelCatalog.APPROX_BYTES
        }

      if (code == 200 && existing > 0) {
        // Server ignored Range — restart.
        partial.delete()
        existing = 0L
      }

      connection.inputStream.use { input ->
        FileOutputStream(partial, existing > 0).use { output ->
          val buffer = ByteArray(64 * 1024)
          var downloaded = existing
          while (true) {
            if (cancelFlag.get()) {
              return Result.failure(IllegalStateException("ダウンロードを中断しました。"))
            }
            val read = input.read(buffer)
            if (read < 0) break
            output.write(buffer, 0, read)
            downloaded += read
            val fraction =
              if (totalFromHeader > 0) {
                (downloaded.toDouble() / totalFromHeader.toDouble()).coerceIn(0.0, 1.0)
              } else {
                0.0
              }
            onProgress(Progress(downloaded, totalFromHeader, fraction, "downloading"))
          }
        }
      }

      if (partial.length() < LlmModelCatalog.MIN_VALID_BYTES) {
        partial.delete()
        return Result.failure(
          IllegalStateException("ファイルが壊れているか小さすぎます。再ダウンロードしてください。"),
        )
      }

      if (LlmModelCatalog.EXPECTED_SHA256.isNotBlank()) {
        onProgress(Progress(partial.length(), partial.length(), 0.99, "verifying"))
        val digest = sha256Hex(partial)
        if (!digest.equals(LlmModelCatalog.EXPECTED_SHA256, ignoreCase = true)) {
          partial.delete()
          return Result.failure(
            IllegalStateException("ファイル検証に失敗しました。再ダウンロードしてください。"),
          )
        }
      }

      if (dest.exists()) {
        dest.delete()
      }
      if (!partial.renameTo(dest)) {
        partial.copyTo(dest, overwrite = true)
        partial.delete()
      }
      onProgress(Progress(dest.length(), dest.length(), 1.0, "complete"))
      return Result.success(dest)
    } finally {
      connection.disconnect()
    }
  }

  private fun sha256Hex(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    RandomAccessFile(file, "r").use { raf ->
      val buffer = ByteArray(64 * 1024)
      while (true) {
        val read = raf.read(buffer)
        if (read < 0) break
        digest.update(buffer, 0, read)
      }
    }
    return digest.digest().joinToString("") { b -> "%02x".format(b) }
  }
}
