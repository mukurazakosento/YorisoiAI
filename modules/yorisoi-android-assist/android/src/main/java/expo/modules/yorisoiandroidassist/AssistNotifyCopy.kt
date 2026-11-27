package expo.modules.yorisoiandroidassist

/**
 * Heads-up / FGS instruction bodies must be short action-only lines
 * (≤17 Japanese chars), e.g. 「通知」をタップ / 長押し.
 * Do not ship long prose and truncate into gibberish — author or derive a minimal line.
 * TTS / in-app displayText stay the fuller pre-#35/#36 spoken baseline
 * (git 88d07c7 / PR #34 tip) — never reuse this notify line as voiceText.
 */
object AssistNotifyCopy {
  const val MAX_CHARS = AssistNotifier.MAX_INSTRUCTION_CHARS

  /** Prefer explicit [notifyText]; else stage/step map; else pattern from display. */
  fun fromGuidance(step: AssistGuidanceRules.Step): String {
    return resolve(step.notifyText, step.displayText, step.stageId, step.stepId)
  }

  fun resolve(
    notifyText: String,
    displayText: String,
    stageId: String = "",
    stepId: String = "",
  ): String {
    val explicit = notifyText.trim()
    if (explicit.isNotEmpty()) {
      return clamp(explicit)
    }
    byStageOrStep(stageId, stepId)?.let {
      return it
    }
    fromDisplayPatterns(displayText)?.let {
      return it
    }
    return essentialsFallback(displayText)
  }

  /** 「ラベル」をタップ — action-only notify (≤17). */
  fun tap(label: String): String {
    val cleaned = label.trim().ifEmpty { "項目" }
    val candidate = "「$cleaned」をタップ"
    if (candidate.length <= MAX_CHARS) {
      return candidate
    }
    val budget = MAX_CHARS - 6 // 「」をタップ
    if (budget >= 2) {
      return "「${cleaned.take(budget)}」をタップ"
    }
    return "項目をタップ"
  }

  fun longPress(label: String = ""): String {
    val cleaned = label.trim()
    if (cleaned.isNotEmpty()) {
      val candidate = "「$cleaned」長押し"
      if (candidate.length <= MAX_CHARS) {
        return candidate
      }
    }
    return "長押し"
  }

  fun scroll(lookFor: String = "", direction: String = "下へ"): String {
    val label = lookFor.trim()
    if (label.isNotEmpty()) {
      val candidate = "「$label」を探す"
      if (candidate.length <= MAX_CHARS) {
        return candidate
      }
      val budget = MAX_CHARS - 4 // 「」を探す
      if (budget >= 2) {
        return "「${label.take(budget)}」を探す"
      }
    }
    return clamp("${direction}スワイプ")
  }

  fun choice(a: String?, b: String?): String {
    if (!a.isNullOrBlank() && !b.isNullOrBlank()) {
      val candidate = "「$a」か「$b」"
      if (candidate.length <= MAX_CHARS) {
        return candidate
      }
      return "どちらをタップ"
    }
    if (!a.isNullOrBlank()) {
      return tap(a)
    }
    return "どこに文字？"
  }

  fun statusRunning(): String = "案内中"

  fun statusPaused(): String = "一時停止中"

  private fun byStageOrStep(stageId: String, stepId: String): String? {
    when (stageId) {
      "uninstall-go-home" -> return "ホームへ"
      "uninstall-long-press" -> return "長押し"
      "uninstall-menu" -> return "「削除」をタップ"
      "uninstall-confirm" -> return "「削除」をタップ"
      "safety-wait" ->
        return if (stepId.contains("email")) "メールを開く" else "番号を出す"
      "safety-result" -> return null // derive from display / risk wording
      "unreadable" -> return "読み取れず"
      "explain-sensitive" -> return "秘密あり"
      "explain-screen" -> return "画面を確認"
    }
    when {
      stageId.startsWith("popup-permission_camera") ||
        stepId.contains("permission_camera", ignoreCase = true) -> return "カメラ許可？"
      stageId.startsWith("popup-permission_mic") -> return "マイク許可？"
      stageId.startsWith("popup-permission_photos") -> return "写真許可？"
      stageId.startsWith("popup-permission_notifications") -> return "通知許可？"
      stageId.startsWith("popup-permission_location") -> return "位置許可？"
      stageId.startsWith("popup-permission_contacts") -> return "連絡先許可？"
      stageId.startsWith("popup-permission_files") -> return "ファイル許可？"
      stageId.startsWith("popup-permission") -> return "許可を選ぶ"
      stageId.startsWith("popup-terms") -> return "規約を確認"
      stageId.startsWith("popup-update") -> return "更新を確認"
      stageId.startsWith("popup-install") -> return "インストール？"
      stageId.startsWith("popup-") -> return "確認画面"
      stepId.startsWith("wifi-") -> return null
      stepId == "ocr-unreadable" -> return "読み取れず"
    }
    return null
  }

  /** Public pattern extract for concrete rewrite paths. */
  fun fromDisplayPatternsSafe(displayText: String): String? = fromDisplayPatterns(displayText)

  private fun fromDisplayPatterns(displayText: String): String? {
    val t = displayText.trim()
    if (t.isEmpty()) {
      return null
    }
    // Safety result phrases (full display kept for in-app; notify is short).
    when {
      t.contains("詐欺の可能性が高い") -> return "詐欺の恐れ"
      t == "注意が必要です" || t.startsWith("注意が必要") -> return "注意が必要"
      // Phone finding lines include both 番号 and 判断できません — prefer 番号を確認.
      t.startsWith("番号「") || (t.contains("番号「") && t.contains("判断")) -> return "番号を確認"
      t.contains("公開情報では判断できません") -> return "判断できません"
      t.contains("メールやメッセージを開いて") -> return "メールを開く"
      t.contains("電話アプリで番号") || t.contains("番号を出して") -> return "番号を出す"
      t.contains("長押し") -> return "長押し"
      t.contains("ホーム画面") || t.startsWith("ホームへ") || t.contains("ホームから") ->
        return "ホームへ"
      t.contains("秘密の文字") -> return "秘密あり"
      t.contains("読み取れません") -> return "読み取れず"
    }

    val tapMatch =
      Regex("""「([^」]{1,20})」(?:を|から)?(?:タップ|押|選)""")
        .find(t)
    if (tapMatch != null) {
      return tap(tapMatch.groupValues[1])
    }

    val scrollLook =
      Regex("""スワイプして、「([^」]{1,16})」を探""")
        .find(t)
    if (scrollLook != null) {
      return scroll(scrollLook.groupValues[1])
    }
    if (t.contains("スワイプ")) {
      return "下へスワイプ"
    }

    val ask =
      Regex("""「([^」]{1,12})」と「([^」]{1,12})」""")
        .find(t)
    if (ask != null && (t.contains("どちら") || t.contains("どっち"))) {
      return choice(ask.groupValues[1], ask.groupValues[2])
    }

    // Popup-style what-line → short topic
    when {
      t.contains("カメラ") && t.contains("聞いている") -> return "カメラ許可？"
      t.contains("マイク") && t.contains("聞いている") -> return "マイク許可？"
      t.contains("写真") && t.contains("聞いている") -> return "写真許可？"
      t.contains("通知") && t.contains("聞いている") -> return "通知許可？"
      t.contains("位置情報") && t.contains("聞いている") -> return "位置許可？"
      t.contains("連絡先") && t.contains("聞いている") -> return "連絡先許可？"
      t.contains("ファイル") && t.contains("聞いている") -> return "ファイル許可？"
      t.contains("利用許可") || t.contains("許可を聞いている") -> return "許可を選ぶ"
      t.contains("利用規約") || t.contains("同意") -> return "規約を確認"
      t.contains("更新") && t.contains("確認") -> return "更新を確認"
      t.contains("入れてよいか") || t.contains("インストール") -> return "インストール？"
      t.contains("確認する画面") || t.contains("確認画面") -> return "確認画面"
      t.contains("画面には「") -> return "画面を確認"
    }

    return null
  }

  /**
   * Last resort: first clause only, never mid-sentence ellipsis gibberish.
   * Prefer a complete short imperative when the clause still exceeds the cap.
   */
  private fun essentialsFallback(displayText: String): String {
    val trimmed = displayText.trim()
    if (trimmed.isEmpty()) {
      return "案内"
    }
    val firstClause =
      trimmed
        .split(Regex("""[。．！？\n]"""))
        .map { it.trim() }
        .firstOrNull { it.isNotEmpty() }
        ?: trimmed
    if (firstClause.length <= MAX_CHARS) {
      return firstClause
    }
    // Drop trailing ください／してください to shorten without gibberish cut.
    val withoutPlease =
      firstClause
        .replace(Regex("""してください$"""), "")
        .replace(Regex("""下さい$"""), "")
        .replace(Regex("""ください$"""), "")
        .trim()
    if (withoutPlease.isNotEmpty() && withoutPlease.length <= MAX_CHARS) {
      return withoutPlease
    }
    // Known short stand-ins rather than 「………」
    return "次の一手"
  }

  private fun clamp(text: String): String {
    val trimmed = text.trim()
    if (trimmed.length <= MAX_CHARS) {
      return trimmed
    }
    // Safety net only — prefer resolve/fromGuidance so this rarely fires.
    return AssistNotifier.truncateForNotify(trimmed, MAX_CHARS)
  }
}
