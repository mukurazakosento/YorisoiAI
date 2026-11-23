package expo.modules.yorisoiandroidassist

/**
 * Stage-aware heuristic guidance (demo / disconnected AI).
 * Instructions are grounded in current OCR labels (quote what is on screen).
 * Never labeled as live AI. Never false-complete on bare 送信/既読/取り消し.
 */
object AssistGuidanceRules {
  data class Step(
    val stepId: String,
    val stageId: String,
    val displayText: String,
    val voiceText: String,
    /** Always "demo" until native Llama is connected. */
    val mode: String = "demo",
  )

  fun buildNextStep(
    featureId: String,
    goalSummary: String,
    ocrText: String,
  ): Step {
    val goal = normalize(goalSummary)
    val raw = ocrText.trim().replace("\\s+".toRegex(), " ")
    val o = normalize(raw)

    if (raw.isEmpty() || o.isEmpty()) {
      return unreadableStep()
    }

    if (featureId == "safetyCheck") {
      val snippet = clipQuote(raw, 24)
      val lookingPhone =
        goal.contains("電話") || goal.contains("番号") || goal.contains("着信")
      val lookingMail =
        goal.contains("メール") || goal.contains("sms") || goal.contains("メッセージ")
      return Step(
        stepId = if (lookingMail) "safety-mail-review" else "safety-phone-review",
        stageId = "safety",
        displayText =
          when {
            lookingPhone -> "「$snippet」など、番号が見えたらアプリに戻って調べてください。"
            lookingMail -> "「$snippet」など、メールの文が見えたらアプリに戻って調べてください。"
            else -> "画面の「$snippet」を確認し、アプリに戻って調べてください。"
          },
        voiceText =
          when {
            lookingPhone ->
              "画面には「$snippet」などとあります。番号を確認したら、よりそいAIに戻って調べてください。安全だと決めつけないでください。自動ではかけません。"
            lookingMail ->
              "画面には「$snippet」などとあります。メールの文を確認したら、よりそいAIに戻って調べてください。リンクはまだ押さないでください。安全だと決めつけないでください。"
            else ->
              "画面には「$snippet」などとあります。確認したらアプリに戻って調べてください。安全だと決めつけないでください。"
          },
      )
    }
    if (featureId == "textExplanation") {
      // Prefer dialog explain; else grounded OCR summary (demo).
      return AssistPopupExplainer.explainScreenText(raw)
    }

    // Popups interrupt stage guidance (operationSupport / etc.).
    val popup = AssistPopupDetector.detect(raw)
    if (popup != null) {
      return AssistPopupExplainer.explain(popup)
    }

    if (looksLikeLinePhotoGoal(goal)) {
      return linePhotoStep(o, raw)
    }
    if (looksLikeWifiGoal(goal)) {
      return wifiStep(o, raw)
    }
    if (looksLikePhoneGoal(goal)) {
      return phoneStep(o, raw)
    }
    if (looksLikeSettingsGoal(goal)) {
      return settingsStep(o, raw)
    }

    return ocrGroundedFallback(raw, goalSummary)
  }

  fun unreadableStep(): Step {
    return Step(
      stepId = "ocr-unreadable",
      stageId = "unreadable",
      displayText = "画面をうまく読み取れませんでした。",
      voiceText = "画面をうまく読み取れませんでした。明るいところで、もう少し待つか、アプリに戻ってください。",
    )
  }

  /**
   * Dedupe announce/TTS by stepId, but re-announce when stage changes
   * or after recovery from unreadable.
   */
  fun shouldAnnounce(
    previousStepId: String?,
    nextStepId: String,
    previousStageId: String? = null,
    nextStageId: String? = null,
  ): Boolean {
    if (nextStepId.isBlank()) {
      return false
    }
    if (previousStageId == "unreadable" && nextStageId != null && nextStageId != "unreadable") {
      return true
    }
    if (previousStageId != null && nextStageId != null && previousStageId != nextStageId) {
      return true
    }
    return previousStepId != nextStepId
  }

  internal fun looksLikeLinePhotoGoal(goalNormalized: String): Boolean {
    val g = goalNormalized
    val line = g.contains("line") || g.contains("ライン") || g.contains("らいん")
    val photo = g.contains("写真") || g.contains("画像") || g.contains("アルバム")
    val sendOrGrandchild = g.contains("送") || g.contains("孫")
    return line && photo && sendOrGrandchild
  }

  private fun looksLikeWifiGoal(g: String): Boolean {
    return g.contains("wifi") ||
      g.contains("wi-fi") ||
      g.contains("ワイファイ") ||
      g.contains("無線lan") ||
      g.contains("無線")
  }

  private fun looksLikePhoneGoal(g: String): Boolean {
    return g.contains("電話") || g.contains("着信") || g.contains("発信") || g.contains("番号")
  }

  private fun looksLikeSettingsGoal(g: String): Boolean {
    return g.contains("設定") || g.contains("通知") || g.contains("アプリを入れ") ||
      g.contains("インストール") || g.contains("アンインストール")
  }

  /** When goal is unclear: still cite OCR, never invent LINE photo steps. */
  private fun ocrGroundedFallback(raw: String, goalSummary: String): Step {
    val snippet = clipQuote(raw, 28)
    val label = firstUiLabel(raw)
    val goalBit = goalSummary.trim().take(20)
    return if (label != null) {
      Step(
        stepId = "ocr-tap-label",
        stageId = "ocr-grounded",
        displayText = "画面の「$label」を押してください。",
        voiceText = "いまの画面には「$snippet」とあります。次は「$label」を一つ押してください。よりそいAIは代わりに押しません。",
      )
    } else {
      Step(
        stepId = "ask-clarify",
        stageId = "clarify",
        displayText = "画面に「$snippet」とあります。やりたいことを一つ教えてください。",
        voiceText = "いまの画面には「$snippet」と見えます。${if (goalBit.isNotEmpty()) "「${goalBit}」について、" else ""}次に押す場所を一つだけ教えてください。決めつけません。",
      )
    }
  }

  private fun wifiStep(o: String, raw: String): Step {
    return when {
      o.contains("接続済み") || o.contains("接続されています") ->
        step(
          "wifi-connected",
          "wifi-connected",
          "つながっているようです。終わってよければ終了してください。",
          "Wi-Fiにつながっているようです。ほかにやることがなければ、終了してください。",
          raw,
          listOf("接続済み", "接続されています", "Wi-Fi", "Wi‑Fi"),
        )
      o.contains("パスワード") ||
        (o.contains("入力") && (o.contains("wifi") || o.contains("wi-fi") || o.contains("ワイファイ"))) ->
        step(
          "wifi-password",
          "wifi-password",
          "「パスワード」欄に控えた文字を入力してください。",
          "画面のパスワード欄に、控えたWi-Fiのパスワードを入力してください。代わりには入力しません。",
          raw,
          listOf("パスワード", "入力"),
        )
      o.contains("wi-fi") || o.contains("wifi") || o.contains("ワイファイ") || o.contains("ネットワーク") ->
        step(
          "wifi-pick",
          "wifi-list",
          "一覧から使いたいWi-Fiの名前を選んでください。",
          "画面の一覧から、使いたいWi-Fiの名前を一つ選んでください。",
          raw,
          listOf("ネットワーク", "Wi-Fi", "Wi‑Fi", "ワイファイ"),
        )
      o.contains("設定") ->
        step(
          "wifi-open-from-settings",
          "wifi-settings",
          "設定の中の「Wi-Fi」を押してください。",
          "いま設定画面です。Wi-Fiの項目を押してください。",
          raw,
          listOf("Wi-Fi", "Wi‑Fi", "設定"),
        )
      else ->
        ocrGroundedOr(
          raw,
          Step(
            stepId = "wifi-open",
            stageId = "wifi-start",
            displayText = "設定アプリを開き、「Wi-Fi」を選んでください。",
            voiceText = "設定アプリを開き、Wi-Fiを選んでください。",
          ),
        )
    }
  }

  private fun phoneStep(o: String, raw: String): Step {
    return when {
      o.contains("通話") || o.contains("着信中") ->
        step(
          "phone-review",
          "phone-active",
          "画面の番号をよく見てから選んでください。",
          "画面の番号をよく見てください。知らない番号なら、急がなくて大丈夫です。",
          raw,
          listOf("通話", "着信中", "発信"),
        )
      o.contains("履歴") || o.contains("着信") || o.contains("発信") ->
        step(
          "phone-log",
          "phone-log",
          "履歴から確認したい番号を一つ選んでください。",
          "履歴の一覧から、確認したい番号を一つ選んでください。",
          raw,
          listOf("履歴", "着信", "発信"),
        )
      else ->
        ocrGroundedOr(
          raw,
          Step(
            stepId = "phone-open",
            stageId = "phone-start",
            displayText = "電話アプリを開いてください。",
            voiceText = "電話アプリを開き、確認したい番号が出るところまで進めてください。",
          ),
        )
    }
  }

  private fun settingsStep(o: String, raw: String): Step {
    return when {
      o.contains("通知") && (o.contains("オン") || o.contains("オフ") || o.contains("許可")) ->
        step(
          "settings-notify-toggle",
          "settings-notify",
          "通知のオン・オフを、必要な方へ合わせてください。",
          "画面の通知スイッチを、必要な方へ一つ合わせてください。",
          raw,
          listOf("通知", "オン", "オフ", "許可"),
        )
      o.contains("通知") ->
        step(
          "settings-notify",
          "settings-notify-list",
          "一覧の「通知」を開いてください。",
          "画面の一覧から「通知」を開いてください。",
          raw,
          listOf("通知"),
        )
      else ->
        ocrGroundedOr(
          raw,
          Step(
            stepId = "settings-open",
            stageId = "settings-home",
            displayText = "直したい項目を一つ開いてください。",
            voiceText = "設定で、直したい項目を一つだけ開いてください。",
          ),
        )
    }
  }

  /**
   * LINE photo stages — each step quotes a visible OCR label when possible.
   */
  private fun linePhotoStep(o: String, raw: String): Step {
    if (hasClearSentConfirmation(o)) {
      return step(
        "line-ask-done",
        "line-ask-done",
        "送れたか、相手の名前と一緒に確認してください。",
        "写真が送れたか、相手の名前と一緒に確認してください。分からなければアプリに戻ってください。",
        raw,
        listOf("送信しました", "送信済み", "トーク", "孫"),
      )
    }
    if (o.contains("送信") || o.contains("送る")) {
      val label = firstMatch(raw, listOf("送信", "送る")) ?: "送信"
      return Step(
        stepId = "line-confirm-send",
        stageId = "line-pre-send",
        displayText = "写真と相手を確かめてから「$label」を押してください。",
        voiceText = "画面に「$label」があります。写真と相手を確かめてから、それを押してください。代わりには押しません。",
      )
    }
    if (o.contains("既読") || o.contains("取り消")) {
      return step(
        "line-confirm-send",
        "line-pre-send",
        "送れても自動では終わりません。画面を確かめてください。",
        "送信や既読だけでは送れたとは決めつけません。画面を確かめてください。",
        raw,
        listOf("既読", "取り消", "送信"),
      )
    }
    if (o.contains("アルバム") || o.contains("ギャラリー") || o.contains("画像を選択") ||
      o.contains("最近の項目") || o.contains("すべての写真") || o.contains("写真を選択")
    ) {
      val label = firstMatch(raw, listOf("最近の項目", "すべての写真", "アルバム", "ギャラリー", "画像を選択", "写真を選択"))
        ?: "写真"
      return Step(
        stepId = "line-pick-photo",
        stageId = "line-album",
        displayText = "「$label」から送りたい写真を一つ選んでください。",
        voiceText = "画面に「$label」とあります。送りたい写真を一つだけ選んでください。",
      )
    }
    if (o.contains("カメラ") && (o.contains("アルバム") || o.contains("画像") || o.contains("写真") || o.contains("ライブラリ"))) {
      val label = firstMatch(raw, listOf("アルバム", "画像", "ライブラリ", "写真")) ?: "アルバム"
      return Step(
        stepId = "line-choose-album",
        stageId = "line-album-choice",
        displayText = "カメラではなく「$label」を選んでください。",
        voiceText = "画面に「$label」があります。カメラではなく、それを選んでください。",
      )
    }
    if (o.contains("添付") || o.contains("プラス") || (o.contains("写真") && (o.contains("選択") || o.contains("送信")))) {
      val label = firstMatch(raw, listOf("写真", "添付", "＋", "+", "アルバム")) ?: "写真"
      return Step(
        stepId = "line-open-attach",
        stageId = "line-chat",
        displayText = "トーク画面の「$label」やプラスを押してください。",
        voiceText = "トーク画面に「$label」などと見えます。写真やプラスのボタンを押してください。",
      )
    }
    if (o.contains("トークルーム") || o.contains("トーク") ||
      (o.contains("メッセージ") && !o.contains("ホーム"))
    ) {
      return Step(
        stepId = "line-in-talk",
        stageId = "line-chat",
        displayText = "トーク画面です。下の写真やプラスを押してください。",
        voiceText = "いまトーク画面の文字が見えます。下の写真やプラスを探して押してください。",
      )
    }
    if (o.contains("チャット一覧") || o.contains("友だち") || o.contains("トーク一覧") ||
      (o.contains("ホーム") && !o.contains("トークルーム"))
    ) {
      val label = firstMatch(raw, listOf("友だち", "チャット一覧", "トーク一覧", "ホーム")) ?: "友だち"
      return Step(
        stepId = "line-pick-friend",
        stageId = "line-friends",
        displayText = "「$label」から孫の名前のトークを開いてください。",
        voiceText = "画面に「$label」とあります。孫の名前を選んでトークを開いてください。",
      )
    }
    if (o.contains("line") || o.contains("ライン")) {
      return step(
        "line-open",
        "line-home",
        "LINEのホームです。友だちやトーク一覧へ進んでください。",
        "いまLINEの画面です。友だちやトーク一覧から孫の名前へ進んでください。",
        raw,
        listOf("LINE", "ライン", "ホーム"),
      )
    }
    // OCR present but no LINE stage match — do NOT invent generic "open LINE" if other UI is visible.
    return ocrGroundedOr(
      raw,
      Step(
        stepId = "line-start",
        stageId = "line-start",
        displayText = "LINEを開き、孫のトークへ進みます。",
        voiceText = "LINEを開き、孫のトークを選んでください。一度に一つです。",
      ),
    )
  }

  internal fun hasClearSentConfirmation(o: String): Boolean {
    val strongSent =
      o.contains("送信しました") ||
        o.contains("送信済み") ||
        o.contains("メッセージを送信") ||
        o.contains("写真を送信")
    if (!strongSent) {
      return false
    }
    val recipientHint =
      o.contains("孫") ||
        o.contains("トーク") ||
        o.contains("さん") ||
        o.contains("チャット")
    return recipientHint
  }

  private fun step(
    stepId: String,
    stageId: String,
    display: String,
    voice: String,
    raw: String,
    labels: List<String>,
  ): Step {
    val seen = firstMatch(raw, labels)
    if (seen == null) {
      return Step(stepId, stageId, display, voice)
    }
    return Step(
      stepId = stepId,
      stageId = stageId,
      displayText = "画面に「$seen」とあります。$display".take(120),
      voiceText = "いまの画面には「$seen」と見えます。$voice",
    )
  }

  /**
   * If OCR already shows a clear UI label, prefer tapping that over a generic start instruction.
   */
  private fun ocrGroundedOr(raw: String, generic: Step): Step {
    val label = firstUiLabel(raw)
    if (label == null) {
      return generic
    }
    val snippet = clipQuote(raw, 28)
    return Step(
      stepId = "${generic.stepId}-ocr",
      stageId = generic.stageId,
      displayText = "画面の「$label」を押してください。",
      voiceText = "画面には「$snippet」とあります。次は「$label」を押してください。${generic.voiceText}",
    )
  }

  private fun firstMatch(raw: String, labels: List<String>): String? {
    for (label in labels) {
      if (raw.contains(label)) {
        return label
      }
    }
    return null
  }

  private fun firstUiLabel(raw: String): String? {
    val candidates =
      listOf(
        "許可しない",
        "許可する",
        "送信",
        "送る",
        "アルバム",
        "ギャラリー",
        "写真",
        "カメラ",
        "設定",
        "Wi-Fi",
        "Wi‑Fi",
        "通知",
        "友だち",
        "トーク",
        "ホーム",
        "キャンセル",
        "同意する",
        "次へ",
        "閉じる",
        "選択",
        "添付",
      )
    return firstMatch(raw, candidates)
  }

  private fun clipQuote(text: String, max: Int): String {
    val t = text.replace("\\s+".toRegex(), " ").trim()
    return if (t.length <= max) t else t.take(max) + "…"
  }

  private fun normalize(text: String): String {
    return text.lowercase().replace("\\s+".toRegex(), "")
  }
}
