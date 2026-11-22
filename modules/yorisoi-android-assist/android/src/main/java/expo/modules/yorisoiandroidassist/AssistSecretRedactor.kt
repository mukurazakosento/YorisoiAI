package expo.modules.yorisoiandroidassist

/**
 * Redacts secrets / PII before TTS, notification body, and FGS text.
 * Prefer masking over quoting raw values from OCR.
 */
object AssistSecretRedactor {
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
  private val card =
    Regex("\\b(?:\\d[ -]*?){13,19}\\b")
  private val email =
    Regex("[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}", RegexOption.IGNORE_CASE)
  /** JP mobile / landline and +81 forms. */
  private val phone =
    Regex(
      "(?:\\+?81[-\\s]?\\d{1,4}|0\\d{1,4})[-\\s]?\\d{1,4}[-\\s]?\\d{3,4}\\b",
    )
  private val myNumber =
    Regex("(?:個人番号|マイナンバー)\\s*[:：]?\\s*\\d{4}\\s*\\d{4}\\s*\\d{4}")
  private val bankAccount =
    Regex("(口座番号|口座)\\s*[:：]?\\s*\\d{4,8}", RegexOption.IGNORE_CASE)

  /** Same masking for notify / FGS / displayText / voice. */
  fun forPublicText(text: String): String = redact(text)

  fun forVoice(text: String): String = redact(text)

  fun containsSensitive(text: String): Boolean {
    return passwordHints.containsMatchIn(text) ||
      otp.containsMatchIn(text) ||
      card.containsMatchIn(text) ||
      email.containsMatchIn(text) ||
      phone.containsMatchIn(text) ||
      myNumber.containsMatchIn(text) ||
      bankAccount.containsMatchIn(text)
  }

  private fun redact(text: String): String {
    var t = text
    t = passwordHints.replace(t, "パスワード（伏せます）")
    t = otp.replace(t, "認証コード（伏せます）")
    t = card.replace(t, "番号（伏せます）")
    t = email.replace(t, "メール（伏せます）")
    t = phone.replace(t, "電話番号（伏せます）")
    t = myNumber.replace(t, "個人番号（伏せます）")
    t = bankAccount.replace(t, "口座番号（伏せます）")
    return t
  }
}
