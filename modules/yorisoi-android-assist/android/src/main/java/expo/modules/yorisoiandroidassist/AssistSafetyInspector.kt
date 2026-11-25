package expo.modules.yorisoiandroidassist

/**
 * On-device phone / email safety heuristics for the MediaProjection FGS loop.
 * Mirrors JS `services/security` enough to advise without reopening the Activity.
 * Never auto-dials, auto-sends, or asserts absolute safety.
 */
object AssistSafetyInspector {
  data class Finding(
    /** Stable id for announce dedupe (includes phone digits or email). */
    val fingerprint: String,
    val mode: String,
    val displayText: String,
    val voiceText: String,
    val riskLevel: String,
  )

  private val phoneRe =
    Regex("""(?:\+?81[-\s]?)?(?:0\d{1,4}|\(0\d{1,4}\))[-\s]?\d{1,4}[-\s]?\d{3,4}|\+81\d{9,11}|0\d{9,10}""")
  private val emailRe =
    Regex("""[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}""")

  fun resolveMode(goalSummary: String): String {
    val blob = goalSummary.replace("\\s+".toRegex(), "").lowercase()
    val phone =
      blob.contains("電話") || blob.contains("番号") || blob.contains("着信") ||
        blob.contains("phone") || blob.contains("dial")
    val mail =
      blob.contains("メール") || blob.contains("mail") || blob.contains("sms") ||
        blob.contains("メッセージ") || blob.contains("リンク")
    return when {
      mail && !phone -> "email"
      phone && !mail -> "phone"
      mail && (blob.contains("メール") || blob.contains("sms")) -> "email"
      phone -> "phone"
      else -> "phone"
    }
  }

  /**
   * Inspect screen text for the armed mode. Returns null when nothing matching yet
   * (caller should keep a quiet waiting step).
   */
  fun inspect(mode: String, screenText: String): Finding? {
    val text = screenText.replace("\\s+".toRegex(), " ").trim()
    if (text.length < 4) {
      return null
    }
    return if (mode == "email") {
      inspectEmail(text)
    } else {
      inspectPhone(text)
    }
  }

  fun waitingStep(mode: String): AssistGuidanceRules.Step {
    return if (mode == "email") {
      AssistGuidanceRules.Step(
        stepId = "safety-waiting-email",
        stageId = "safety-wait",
        displayText = "メールやメッセージを開いてください。見つかったら通知でお伝えします。",
        voiceText =
          "メールやメッセージのアプリを開いてください。怪しい文が見つかったら、通知と音声でお伝えします。アプリに戻らなくて大丈夫です。リンクはまだ押さないでください。自動では送りません。",
      )
    } else {
      AssistGuidanceRules.Step(
        stepId = "safety-waiting-phone",
        stageId = "safety-wait",
        displayText = "電話アプリで番号を出してください。見つかったら通知でお伝えします。",
        voiceText =
          "電話アプリを開いて、気になる番号が見えるようにしてください。番号が見つかったら、通知と音声でお伝えします。アプリに戻らなくて大丈夫です。自動ではかけません。",
      )
    }
  }

  fun toGuidanceStep(finding: Finding): AssistGuidanceRules.Step {
    return AssistGuidanceRules.Step(
      stepId = "safety-hit-${finding.fingerprint}",
      stageId = "safety-result",
      displayText = finding.displayText,
      voiceText = finding.voiceText,
      mode = "demo",
    )
  }

  /**
   * Prefer the text blob that contains a mode-matching phone/email.
   * Falls back to the longer non-empty string.
   */
  fun pickBestSafetyText(ocrText: String, a11yText: String, mode: String): String {
    val ocr = ocrText.replace("\\s+".toRegex(), " ").trim()
    val a11y = a11yText.replace("\\s+".toRegex(), " ").trim()
    if (a11y.isBlank()) return ocr
    if (ocr.isBlank()) return a11y
    val ocrHit = inspect(mode, ocr) != null
    val a11yHit = inspect(mode, a11y) != null
    return when {
      a11yHit && !ocrHit -> a11y
      ocrHit && !a11yHit -> ocr
      a11yHit && a11y.length >= ocr.length -> a11y
      else -> ocr
    }
  }

  private fun inspectPhone(text: String): Finding? {
    val phones = extractPhones(text)
    if (phones.isEmpty()) {
      return null
    }
    val primary = phones.first()
    val kind = classifyJapanesePhone(primary.digits)
    val display =
      "番号「${primary.display}」は${kind.label}です。公開情報では判断できません"
    val voice =
      "番号は${kind.label}です。${kind.hint}安全とは言い切れません。お金や個人情報を求められたら、特に注意してください。自動ではかけません。"
    return Finding(
      fingerprint = "phone-${primary.digits}",
      mode = "phone",
      displayText = display.take(80),
      voiceText = voice,
      riskLevel = "insufficient_info",
    )
  }

  private fun inspectEmail(text: String): Finding? {
    val emails = extractEmails(text)
    val urls = Regex("""https?://[^\s<>"')\]]+|www\.[^\s<>"')\]]+""", RegexOption.IGNORE_CASE)
      .findAll(text)
      .map { it.value }
      .toList()
    val hits = detectScamPatterns(text)
    if (emails.isEmpty() && hits.isEmpty() && urls.isEmpty()) {
      // Need some mail-like content; bare UI chrome is not enough.
      val n = text.replace("\\s+".toRegex(), "")
      val looksMail =
        n.contains("メール") || n.contains("受信") || n.contains("件名") ||
          n.contains("inbox", ignoreCase = true) || n.contains("sms")
      if (!looksMail) {
        return null
      }
      // Screen looks like mail but no clear risk / address yet — still wait.
      return null
    }

    // If we only have emails with no scam cues and no body-like length, still advise caution-light.
    val sender = emails.firstOrNull()?.display
    val senderNote =
      if (sender != null) "差出人らしき文字「$sender」が見えます。" else "差出人は特定できませんでした。"

    val fakePolice = detectFakePolicePatterns(text)
    if (isFakePoliceStyle(fakePolice, hits)) {
      val reasons = (fakePolice + hits).distinct().joinToString("。")
      return Finding(
        fingerprint = "email-fake-police-${fingerprintKey(text, emails, hits + fakePolice)}",
        mode = "email",
        displayText = "詐欺の可能性が高いメールです",
        voiceText =
          "$senderNote 詐欺の可能性が高いメールです。怪しいと考えられる理由: $reasons。URLは開かず、個人情報や振込もしないでください。不安なら家族か、警察相談のシャープくじゅういちゼロに相談してください。絶対に詐欺とは言い切りませんが、急いで手続きしないでください。自動では送りません。",
        riskLevel = "dangerous",
      )
    }

    return when {
      hits.size >= 2 -> {
        val labels = hits.joinToString("。")
        Finding(
          fingerprint = "email-danger-${fingerprintKey(text, emails, hits)}",
          mode = "email",
          displayText = "詐欺の可能性が高いメールです",
          voiceText =
            "$senderNote 詐欺の可能性が高いメールです。怪しいと考えられる理由: $labels。リンクは開かず、返信しないでください。安全とは言いません。自動では送りません。",
          riskLevel = "dangerous",
        )
      }
      hits.isNotEmpty() || urls.isNotEmpty() -> {
        Finding(
          fingerprint = "email-caution-${fingerprintKey(text, emails, hits)}",
          mode = "email",
          displayText = "注意が必要です",
          voiceText =
            "$senderNote 気になる点があります。リンクを開いたり個人情報を送ったりする前に、公式の案内と見比べてください。安全とは言い切れません。自動では送りません。",
          riskLevel = "caution",
        )
      }
      else -> {
        Finding(
          fingerprint = "email-info-${fingerprintKey(text, emails, hits)}",
          mode = "email",
          displayText = "公開情報では判断できません",
          voiceText =
            "$senderNote 目立った危険な言い回しは見つかりませんでしたが、それだけで安全とは言いません。不安なら返信を急がないでください。自動では送りません。",
          riskLevel = "insufficient_info",
        )
      }
    }
  }

  private fun fingerprintKey(
    text: String,
    emails: List<EmailCandidate>,
    hits: List<String>,
  ): String {
    val base =
      emails.firstOrNull()?.normalized
        ?: text.take(40).replace("\\s+".toRegex(), "")
    return "${base.hashCode()}-${hits.size}"
  }

  private data class PhoneCandidate(val display: String, val digits: String)
  private data class EmailCandidate(val display: String, val normalized: String)
  private data class PhoneKind(val label: String, val hint: String)

  private fun extractPhones(text: String): List<PhoneCandidate> {
    val seen = linkedSetOf<String>()
    val out = mutableListOf<PhoneCandidate>()
    for (match in phoneRe.findAll(text)) {
      val display = match.value.trim()
      val digits = normalizePhoneDigits(display)
      if (digits.length < 10 || digits.length > 13) continue
      if (!seen.add(digits)) continue
      out.add(PhoneCandidate(display, digits))
    }
    return out
  }

  private fun extractEmails(text: String): List<EmailCandidate> {
    val seen = linkedSetOf<String>()
    val out = mutableListOf<EmailCandidate>()
    for (match in emailRe.findAll(text)) {
      val display = match.value.trim().trimEnd('.', ',', ';', '!', '?', ')', '）')
      val normalized = display.lowercase()
      if (normalized.length < 6 || !normalized.contains('@')) continue
      if (!seen.add(normalized)) continue
      out.add(EmailCandidate(display, normalized))
    }
    return out
  }

  private fun normalizePhoneDigits(value: String): String {
    val trimmed = value.trim()
    return if (trimmed.startsWith("+")) {
      "+" + trimmed.drop(1).filter { it.isDigit() }
    } else {
      trimmed.filter { it.isDigit() }
    }
  }

  private fun classifyJapanesePhone(phoneNumber: String): PhoneKind {
    val bare =
      normalizePhoneDigits(phoneNumber)
        .removePrefix("+81")
        .let { if (it.startsWith("0")) it else "0$it" }
        .filter { it.isDigit() }

    return when {
      bare == "110" || bare == "119" || bare == "118" || bare == "171" ->
        PhoneKind(
          "緊急・公的な短い番号の形",
          "本物の緊急通報か、画面の表示をよく確認してください。",
        )
      bare.startsWith("0120") || bare.startsWith("0800") || bare.startsWith("0570") ->
        PhoneKind(
          "フリーダイヤルやナビダイヤルに多い番号の形",
          "番号の形だけでは相手が本物かは分かりません。",
        )
      bare.startsWith("090") || bare.startsWith("080") || bare.startsWith("070") ->
        PhoneKind(
          "携帯電話に多い番号の形",
          "知らない番号でも、すぐにかけ直す必要はありません。",
        )
      bare.startsWith("050") ->
        PhoneKind(
          "IP電話などに多い番号の形",
          "迷惑電話の報告で話題になることもありますが、番号だけでは判断できません。",
        )
      bare.matches(Regex("""^0\d{9,10}$""")) ->
        PhoneKind(
          "固定電話に多い番号の形",
          "表示名や着信の様子もあわせて見てください。",
        )
      else ->
        PhoneKind(
          "番号の種類を端末だけでは特定できませんでした",
          "番号の形だけでは相手が信頼できるかは分かりません。",
        )
    }
  }

  private fun detectScamPatterns(text: String): List<String> {
    val n = text.replace("\\s+".toRegex(), "")
    val hits = mutableListOf<String>()
    if (Regex("""至急|すぐに|今すぐ|期限|残り\d|放置|本日中|あと\d""").containsMatchIn(n)) {
      hits.add("不自然に急がせる表現")
    }
    if (Regex("""未払い|支払い|料金|請求|振込|振り込み|口座|送金|ギフト券""").containsMatchIn(n)) {
      hits.add("料金・振込・金銭の要求")
    }
    if (Regex("""アカウント.*停止|停止.*アカウント|凍結|利用停止|ログイン.*確認""").containsMatchIn(n)) {
      hits.add("アカウント停止を口実にした誘導")
    }
    if (Regex("""パスワード|暗証番号|認証コード|個人情報|マイナンバー|クレジットカード""").containsMatchIn(n)) {
      hits.add("個人情報や暗証の要求")
    }
    if (Regex("""http|www\.|bit\.ly|クリック|こちらをタップ|リンク""", RegexOption.IGNORE_CASE).containsMatchIn(text)) {
      hits.add("リンクへの誘導")
    }
    if (
      Regex("""税務署|警察|警察庁|警視庁|裁判所|配送業者|ヤマト|佐川|Amazon|アマゾン|Apple|アップル|銀行|カード会社""")
        .containsMatchIn(n) &&
      (Regex("""です|ます|ください|お願い""").containsMatchIn(n) || hits.isNotEmpty())
    ) {
      hits.add("公的機関や有名企業を名乗る可能性")
    }
    if (Regex("""捜査対象|被疑者|容疑者|逮捕|保釈|保釈金""").containsMatchIn(n)) {
      hits.add("捜査・逮捕・保釈など不安を煽る表現")
    }
    if (Regex("""当選|還付|給付金|無料で貰える|特別なご案内""").containsMatchIn(n)) {
      hits.add("当選・還付などの甘い話")
    }
    return hits
  }

  /** Mirrors JS detectFakePolicePatterns — reasons only, no absolute certainty. */
  private fun detectFakePolicePatterns(text: String): List<String> {
    val n = text.replace("\\s+".toRegex(), "")
    val hits = mutableListOf<String>()
    if (Regex("""警察庁|警視庁|警察署|警察官|警察から|サイバー捜査|捜査機関""").containsMatchIn(n)) {
      hits.add("警察や捜査機関を名乗っている")
    }
    if (Regex("""捜査対象|被疑者|容疑者|犯罪に利用|口座が犯罪|不正利用の疑い""").containsMatchIn(n)) {
      hits.add("捜査対象や犯罪利用をほのめかして不安にさせている")
    }
    if (Regex("""逮捕|身柄|連行|処罰""").containsMatchIn(n)) {
      hits.add("逮捕などの強い脅しがある")
    }
    if (Regex("""保釈|保釈金""").containsMatchIn(n)) {
      hits.add("保釈金など金銭の話が出ている")
    }
    if (
      Regex("""http|www\.|bit\.ly|クリック|こちらをタップ|下記URL|URLから|リンク""", RegexOption.IGNORE_CASE)
        .containsMatchIn(text) &&
      (Regex("""至急|すぐに|今すぐ|本日中|放置""").containsMatchIn(n) || hits.isNotEmpty())
    ) {
      hits.add("急いでURLを開かせようとしている")
    }
    return hits
  }

  private fun isFakePoliceStyle(fakeHits: List<String>, scamHits: List<String>): Boolean {
    val blob = (fakeHits + scamHits).joinToString("")
    val hasPolice =
      fakeHits.any { it.contains("警察") || it.contains("捜査対象") } ||
        scamHits.any { it.contains("公的機関") }
    val hasFear =
      fakeHits.any { it.contains("逮捕") || it.contains("保釈") || it.contains("捜査対象") } ||
        scamHits.any { it.contains("捜査・逮捕") }
    val hasLure =
      fakeHits.any { it.contains("URL") } ||
        scamHits.any {
          it.contains("リンク") || it.contains("急がせ") || it.contains("金銭")
        }
    return hasPolice && (hasFear || hasLure) && fakeHits.size + scamHits.size >= 2 &&
      blob.isNotEmpty()
  }
}
