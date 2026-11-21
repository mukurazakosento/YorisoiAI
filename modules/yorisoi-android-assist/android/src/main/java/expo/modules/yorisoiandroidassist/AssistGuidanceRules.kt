package expo.modules.yorisoiandroidassist

/**
 * Structured heuristic guidance from OCR text (demo / disconnected AI).
 * Never labeled as live AI.
 *
 * LINE photo steps only when the **goal** clearly asks to send a LINE photo.
 * Wi‑Fi / settings / phone / unknown never invent LINE steps.
 * Completion never fires on mere 「送信」「既読」「取り消し」 alone.
 */
object AssistGuidanceRules {
  data class Step(
    val stepId: String,
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
    val o = normalize(ocrText)

    if (featureId == "safetyCheck") {
      return Step(
        stepId = "safety-review",
        displayText = "画面の番号や文言をよく見てください。断定はしません。",
        voiceText = "画面に出ている番号や文言を、ゆっくり確認してください。安全だと決めつけず、分からなければ終了して相談してください。",
      )
    }
    if (featureId == "textExplanation") {
      return Step(
        stepId = "explain-read",
        displayText = "画面の文を読み取りました。意味が分からなければ「分かりません」。",
        voiceText = "いまの画面の文字を読み取りました。難しい言葉があれば、アプリに戻って「分かりません」を押してください。",
      )
    }

    // operationSupport (and unknown): route by goal only — never force LINE from OCR alone
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

  /** Pure helper for tests / callers: same stepId must not re-announce. */
  fun shouldAnnounce(previousStepId: String?, nextStepId: String): Boolean {
    if (nextStepId.isBlank()) {
      return false
    }
    return previousStepId != nextStepId
  }

  internal fun looksLikeLinePhotoGoal(goalNormalized: String): Boolean {
    val g = goalNormalized
    val line = g.contains("line") || g.contains("ライン") || g.contains("らいん")
    val photo = g.contains("写真") || g.contains("画像") || g.contains("アルバム")
    val sendOrGrandchild = g.contains("送") || g.contains("孫")
    // Require LINE + photo-ish + send/grandchild — not bare LINE通知/使い方
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
      displayText = "いまの画面で、やりたいことを一つ教えてください。",
      voiceText = "いまの画面で、何をしたいか一つだけ教えてください。分からなければアプリに戻って文字で書いてください。LINEの写真送信だとは決めつけません。",
    )
  }

  private fun wifiStep(o: String): Step {
    return when {
      o.contains("接続済み") || o.contains("接続されています") ->
        Step(
          stepId = "wifi-connected",
          displayText = "つながっているようです。ほかにやることがなければ終了できます。",
          voiceText = "Wi-Fiにつながっているようです。ほかにやることがなければ、通知から支援を終了してください。",
        )
      o.contains("wi-fi") || o.contains("wifi") || o.contains("ワイファイ") || o.contains("ネットワーク") ->
        Step(
          stepId = "wifi-pick",
          displayText = "使いたいWi-Fiの名前を選んでください。",
          voiceText = "一覧から、使いたいWi-Fiの名前を一つ選んでください。パスワードを聞かれたら、控えたものを入力します。",
        )
      else ->
        Step(
          stepId = "wifi-open",
          displayText = "設定からWi-Fiを開いてください。",
          voiceText = "設定アプリを開き、Wi-Fiを選んでください。よりそいAIは代わりに押しません。",
        )
    }
  }

  private fun phoneStep(o: String): Step {
    return when {
      o.contains("通話") || o.contains("発信") || o.contains("着信") ->
        Step(
          stepId = "phone-review",
          displayText = "番号をよく見てから、かけるか切るか選んでください。",
          voiceText = "画面の番号をよく見てください。知らない番号なら、急いでかけなくて大丈夫です。",
        )
      else ->
        Step(
          stepId = "phone-open",
          displayText = "電話アプリで、確認したい番号の画面を開いてください。",
          voiceText = "電話アプリを開き、確認したい番号が出るところまで進めてください。",
        )
    }
  }

  private fun settingsStep(o: String): Step {
    return when {
      o.contains("通知") ->
        Step(
          stepId = "settings-notify",
          displayText = "通知のスイッチを、必要な方へ合わせてください。",
          voiceText = "通知の項目を開き、オンやオフを必要な方へ合わせてください。一度に一つです。",
        )
      else ->
        Step(
          stepId = "settings-open",
          displayText = "設定で、直したい項目を一つ開いてください。",
          voiceText = "設定アプリで、直したい項目を一つだけ開いてください。分からなければアプリに戻って聞いてください。",
        )
    }
  }

  private fun linePhotoStep(o: String): Step {
    // Safe completion: never complete on mere 送信 / 既読 / 取り消し
    if (hasClearSentConfirmation(o)) {
      return Step(
        stepId = "line-ask-done",
        displayText = "送れたか確認してください。分からなければアプリに戻ります。",
        voiceText = "写真が送れたか、相手の名前と一緒に確認してください。はっきり分からなければ、送れましたとは決めつけず、アプリに戻って「できました」か「分かりません」を押してください。",
      )
    }
    if (o.contains("送信") || o.contains("送る") || o.contains("既読") || o.contains("取り消")) {
      return Step(
        stepId = "line-confirm-send",
        displayText = "内容を確かめてから「送信」を押してください。送れても自動では終わりません。",
        voiceText = "写真と相手の名前を確かめてから、送信を押してください。送信や既読の文字だけでは、送れたとは決めつけません。よりそいAIは代わりに押しません。",
      )
    }
    if (o.contains("アルバム") || o.contains("ギャラリー") || o.contains("画像を選択") ||
      o.contains("最近の項目") || o.contains("すべての写真")
    ) {
      return Step(
        stepId = "line-pick-photo",
        displayText = "送りたい写真を一つ選んでください。",
        voiceText = "送りたい写真を一つだけ選んでください。選んだら次の案内を待ちます。",
      )
    }
    if (o.contains("カメラ") && (o.contains("アルバム") || o.contains("画像") || o.contains("写真"))) {
      return Step(
        stepId = "line-choose-album",
        displayText = "「アルバム」や「画像」を選んでください。",
        voiceText = "カメラではなく、アルバムや画像を選んでください。孫に送る写真は、すでに撮ったものを使うことが多いです。",
      )
    }
    if (o.contains("添付") || o.contains("アルバム") || o.contains("ギャラリー") ||
      (o.contains("写真") && o.contains("選択"))
    ) {
      return Step(
        stepId = "line-open-attach",
        displayText = "写真を付けるボタン（＋など）を押してください。",
        voiceText = "トーク画面の、写真を付けるボタンやプラスを押してください。よりそいAIは代わりに押しません。",
      )
    }
    if (o.contains("トーク") || o.contains("トークルーム") ||
      (o.contains("メッセージ") && !o.contains("ホーム"))
    ) {
      return Step(
        stepId = "line-in-talk",
        displayText = "孫とのトークを開いたまま、写真ボタンを探してください。",
        voiceText = "孫とのトーク画面です。下のほうにある写真やプラスのボタンを探して押してください。",
      )
    }
    if (o.contains("ホーム") || o.contains("友だち") || o.contains("チャット一覧")) {
      return Step(
        stepId = "line-pick-friend",
        displayText = "孫の名前のトークを開いてください。",
        voiceText = "友だち一覧から、孫の名前を選んでトークを開いてください。",
      )
    }
    if (o.contains("line") || o.contains("ライン")) {
      return Step(
        stepId = "line-open",
        displayText = "まず LINE を開き、孫のトークを選んでください。",
        voiceText = "緑のLINEアプリを開き、孫の名前のトークを選んでください。開けたらそのままで大丈夫です。",
      )
    }
    return Step(
      stepId = "line-start",
      displayText = "LINEを開き、孫のトークから写真を送ります。",
      voiceText = "LINEを開き、孫のトークを選んでから写真を一つ付けてください。一度に一つです。勝手には送りません。",
    )
  }

  /**
   * Requires a stronger sent phrase than bare 送信/既読/取り消し.
   * Even then we only ask the user to confirm — never auto-declare success alone.
   */
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
