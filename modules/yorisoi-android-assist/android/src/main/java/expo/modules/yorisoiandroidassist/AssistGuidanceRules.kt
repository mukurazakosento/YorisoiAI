package expo.modules.yorisoiandroidassist

/**
 * Stage-aware heuristic guidance (demo / disconnected AI).
 * Combines goal + OCR to detect screen stage, then one next action.
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
    val raw = ocrText.trim()
    val o = normalize(raw)

    if (raw.isEmpty() || o.isEmpty()) {
      return unreadableStep()
    }

    if (featureId == "safetyCheck") {
      return Step(
        stepId = "safety-review",
        stageId = "safety",
        displayText = "番号や文言をよく見てください。",
        voiceText = "画面の番号や文言をゆっくり確認してください。安全だと決めつけないでください。",
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
      return linePhotoStep(o)
    }
    if (looksLikeWifiGoal(goal)) {
      return wifiStep(o)
    }
    if (looksLikePhoneGoal(goal)) {
      return phoneStep(o)
    }
    if (looksLikeSettingsGoal(goal)) {
      return settingsStep(o)
    }

    return askClarifyStep()
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

  private fun askClarifyStep(): Step {
    return Step(
      stepId = "ask-clarify",
      stageId = "clarify",
      displayText = "やりたいことを一つ教えてください。",
      voiceText = "いまの画面で、何をしたいか一つだけ教えてください。LINEの写真送信だとは決めつけません。",
    )
  }

  private fun wifiStep(o: String): Step {
    return when {
      o.contains("接続済み") || o.contains("接続されています") ->
        Step(
          stepId = "wifi-connected",
          stageId = "wifi-connected",
          displayText = "つながっているようです。終わってよければ終了してください。",
          voiceText = "Wi-Fiにつながっているようです。ほかにやることがなければ、終了してください。",
        )
      o.contains("パスワード") || o.contains("入力") ->
        Step(
          stepId = "wifi-password",
          stageId = "wifi-password",
          displayText = "パスワードを入力してください。",
          voiceText = "控えたWi-Fiのパスワードを入力してください。よりそいAIは代わりに入力しません。",
        )
      o.contains("wi-fi") || o.contains("wifi") || o.contains("ワイファイ") || o.contains("ネットワーク") ->
        Step(
          stepId = "wifi-pick",
          stageId = "wifi-list",
          displayText = "使いたいWi-Fiの名前を選んでください。",
          voiceText = "一覧から、使いたいWi-Fiの名前を一つ選んでください。",
        )
      o.contains("設定") ->
        Step(
          stepId = "wifi-open-from-settings",
          stageId = "wifi-settings",
          displayText = "「Wi-Fi」を開いてください。",
          voiceText = "設定の中のWi-Fiを押してください。",
        )
      else ->
        Step(
          stepId = "wifi-open",
          stageId = "wifi-start",
          displayText = "設定からWi-Fiを開いてください。",
          voiceText = "設定アプリを開き、Wi-Fiを選んでください。",
        )
    }
  }

  private fun phoneStep(o: String): Step {
    return when {
      o.contains("通話") || o.contains("発信") || o.contains("着信中") ->
        Step(
          stepId = "phone-review",
          stageId = "phone-active",
          displayText = "番号をよく見てから選んでください。",
          voiceText = "画面の番号をよく見てください。知らない番号なら、急がなくて大丈夫です。",
        )
      o.contains("履歴") || o.contains("着信") || o.contains("発信") ->
        Step(
          stepId = "phone-log",
          stageId = "phone-log",
          displayText = "確認したい番号を選んでください。",
          voiceText = "履歴から、確認したい番号を一つ選んでください。",
        )
      else ->
        Step(
          stepId = "phone-open",
          stageId = "phone-start",
          displayText = "電話アプリを開いてください。",
          voiceText = "電話アプリを開き、確認したい番号が出るところまで進めてください。",
        )
    }
  }

  private fun settingsStep(o: String): Step {
    return when {
      o.contains("通知") && (o.contains("オン") || o.contains("オフ") || o.contains("許可")) ->
        Step(
          stepId = "settings-notify-toggle",
          stageId = "settings-notify",
          displayText = "通知のスイッチを合わせてください。",
          voiceText = "通知のオン・オフを、必要な方へ合わせてください。一度に一つです。",
        )
      o.contains("通知") ->
        Step(
          stepId = "settings-notify",
          stageId = "settings-notify-list",
          displayText = "「通知」を開いてください。",
          voiceText = "一覧から通知を開いてください。",
        )
      else ->
        Step(
          stepId = "settings-open",
          stageId = "settings-home",
          displayText = "直したい項目を一つ開いてください。",
          voiceText = "設定で、直したい項目を一つだけ開いてください。",
        )
    }
  }

  /**
   * LINE photo stages (goal must already be LINE photo):
   * home/friends → chat list → chat → album → confirm → pre-send → ask-done
   */
  private fun linePhotoStep(o: String): Step {
    if (hasClearSentConfirmation(o)) {
      return Step(
        stepId = "line-ask-done",
        stageId = "line-ask-done",
        displayText = "送れたか確認してください。",
        voiceText = "写真が送れたか、相手の名前と一緒に確認してください。分からなければアプリに戻ってください。",
      )
    }
    // Pre-send / confirm compose
    if (o.contains("送信") || o.contains("送る")) {
      return Step(
        stepId = "line-confirm-send",
        stageId = "line-pre-send",
        displayText = "確かめてから「送信」を押してください。",
        voiceText = "写真と相手を確かめてから、送信を押してください。代わりには押しません。",
      )
    }
    if (o.contains("既読") || o.contains("取り消")) {
      return Step(
        stepId = "line-confirm-send",
        stageId = "line-pre-send",
        displayText = "送れても自動では終わりません。確かめてください。",
        voiceText = "送信や既読だけでは送れたとは決めつけません。画面を確かめてください。",
      )
    }
    if (o.contains("アルバム") || o.contains("ギャラリー") || o.contains("画像を選択") ||
      o.contains("最近の項目") || o.contains("すべての写真")
    ) {
      return Step(
        stepId = "line-pick-photo",
        stageId = "line-album",
        displayText = "送りたい写真を一つ選んでください。",
        voiceText = "送りたい写真を一つだけ選んでください。",
      )
    }
    if (o.contains("カメラ") && (o.contains("アルバム") || o.contains("画像") || o.contains("写真"))) {
      return Step(
        stepId = "line-choose-album",
        stageId = "line-album-choice",
        displayText = "「アルバム」や「画像」を選んでください。",
        voiceText = "カメラではなく、アルバムや画像を選んでください。",
      )
    }
    if (o.contains("添付") || (o.contains("写真") && o.contains("選択"))) {
      return Step(
        stepId = "line-open-attach",
        stageId = "line-chat",
        displayText = "写真ボタン（＋など）を押してください。",
        voiceText = "トーク画面の、写真やプラスのボタンを押してください。",
      )
    }
    if (o.contains("トークルーム") || o.contains("トーク") ||
      (o.contains("メッセージ") && !o.contains("ホーム"))
    ) {
      return Step(
        stepId = "line-in-talk",
        stageId = "line-chat",
        displayText = "写真ボタンを探して押してください。",
        voiceText = "孫とのトーク画面です。下の写真やプラスを探して押してください。",
      )
    }
    if (o.contains("チャット一覧") || o.contains("友だち") ||
      (o.contains("ホーム") && !o.contains("トークルーム"))
    ) {
      return Step(
        stepId = "line-pick-friend",
        stageId = "line-friends",
        displayText = "孫の名前のトークを開いてください。",
        voiceText = "友だち一覧から、孫の名前を選んでください。",
      )
    }
    if (o.contains("line") || o.contains("ライン")) {
      return Step(
        stepId = "line-open",
        stageId = "line-home",
        displayText = "まず LINE を開いてください。",
        voiceText = "緑のLINEアプリを開いてください。",
      )
    }
    return Step(
      stepId = "line-start",
      stageId = "line-start",
      displayText = "LINEを開き、孫のトークへ進みます。",
      voiceText = "LINEを開き、孫のトークを選んでください。一度に一つです。",
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

  private fun normalize(text: String): String {
    return text.lowercase().replace("\\s+".toRegex(), "")
  }
}
