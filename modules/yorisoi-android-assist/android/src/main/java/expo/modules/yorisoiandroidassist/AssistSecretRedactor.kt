package expo.modules.yorisoiandroidassist

/**
 * Redacts secrets from text before TTS / long notifications.
 * Display guidance may keep short masked hints; voice must not speak raw secrets.
 */
object AssistSecretRedactor {
  private val passwordHints =
    Regex("(パスワード|パスコード|暗証番号|password|passcode)\\s*[:：]?\\s*\\S+", RegexOption.IGNORE_CASE)
  private val otp =
    Regex("(認証コード|確認コード|ワンタイム|OTP|コード)\\s*[:：]?\\s*\\d{4,8}", RegexOption.IGNORE_CASE)
  private val card =
    Regex("\\b(?:\\d[ -]*?){13,19}\\b")
  private val email =
    Regex("[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}", RegexOption.IGNORE_CASE)

  fun forVoice(text: String): String {
    var t = text
    t = passwordHints.replace(t, "パスワード（伏せます）")
    t = otp.replace(t, "認証コード（伏せます）")
    t = card.replace(t, "番号（伏せます）")
    t = email.replace(t, "メール（伏せます）")
    return t
  }

  fun containsSensitive(text: String): Boolean {
    return passwordHints.containsMatchIn(text) ||
      otp.containsMatchIn(text) ||
      card.containsMatchIn(text)
  }
}
