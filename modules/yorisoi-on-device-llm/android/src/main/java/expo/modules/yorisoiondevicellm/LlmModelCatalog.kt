package expo.modules.yorisoiondevicellm

/**
 * Catalog entry for the default on-device model.
 * No API keys. Download URL is public model hosting (Hugging Face).
 */
object LlmModelCatalog {
  const val MODEL_ID = "gemma-3-1b-it-int4"
  const val DISPLAY_NAME = "Gemma 3 1B Instruct (int4)"
  const val ENGINE_NAME = "mediapipe-genai"
  /** Approximate download size in bytes (~555 MB). */
  const val APPROX_BYTES = 555L * 1024L * 1024L
  const val LICENSE_NAME = "Gemma Terms of Use"
  const val LICENSE_URL = "https://ai.google.dev/gemma/terms"
  const val FILE_NAME = "gemma3-1b-it-int4.task"
  /**
   * Default download URL (LiteRT community / mirror).
   * Override at runtime via startDownload({ url }).
   * User must accept Gemma terms via in-app consent before download.
   */
  const val DEFAULT_DOWNLOAD_URL =
    "https://huggingface.co/litert-community/Gemma3-1B-IT/resolve/main/gemma3-1b-it-int4.task"
  /** SHA-256 left empty when host may rotate builds; length check is primary. */
  const val EXPECTED_SHA256 = ""
  const val MIN_VALID_BYTES = 80L * 1024L * 1024L
}
