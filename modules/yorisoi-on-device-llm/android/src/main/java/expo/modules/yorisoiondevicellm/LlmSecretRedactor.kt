package expo.modules.yorisoiondevicellm

/**
 * Mask passwords / OTP / cards / contact PII before prompts and public text.
 * Kept local to this module (mirrors assist redactor; no image handling).
 */
object LlmSecretRedactor {
  private val passwordHints =
    Regex(
      "(パスワード|パスコード|暗証番号|合言葉|password|passcode|passwd)\\s*[:：=]?\\s*\\S+",
      RegexOption.IGNORE_CASE,
    )
  private val otp =
    Regex(
      "(認証コード|確認コード|ワンタイム|セキュリティコード|OTP|コード)\\s*[:：=]?\\s*\\d{4,8}",
      RegexOption.IGNORE_CASE,
    )
  private val card = Regex("\\b(?:\\d[ -]*?){13,19}\\b")
  private val email =
    Regex("[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}", RegexOption.IGNORE_CASE)
  private val phone =
    Regex(
      "(?:\\+?81[-\\s]?\\d{1,4}|0\\d{1,4})[-\\s]?\\d{1,4}[-\\s]?\\d{3,4}\\b",
    )

  fun redact(text: String): String {
    var t = text
    t = passwordHints.replace(t, "パスワード（伏せます）")
    t = otp.replace(t, "認証コード（伏せます）")
    t = card.replace(t, "番号（伏せます）")
    t = email.replace(t, "メール（伏せます）")
    t = phone.replace(t, "電話番号（伏せます）")
    return t
  }
}
