package expo.modules.yorisoiandroidassist

/**
 * Structured heuristic guidance from OCR text (demo / disconnected AI).
 * Never labeled as live AI. Priority scenario: LINE — send a photo to grandchild.
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
    val n = (goalSummary + " " + ocrText).lowercase().replace("\\s+".toRegex(), "")
    val o = ocrText.replace("\\s+".toRegex(), "")

    if (featureId == "operationSupport" || looksLikeLinePhotoGoal(n)) {
      return linePhotoStep(o, n)
    }
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
    return Step(
      stepId = "generic-one",
      displayText = "近いボタンを、一つだけ押してください。",
      voiceText = "画面の中で、やりたいことにいちばん近いボタンを一つだけ押してください。勝手には操作しません。",
    )
  }

  private fun looksLikeLinePhotoGoal(n: String): Boolean {
    val line = n.contains("line") || n.contains("ライン") || n.contains("らいん")
    val photo = n.contains("写真") || n.contains("画像") || n.contains("アルバム")
    val send = n.contains("送") || n.contains("孫") || n.contains("トーク")
    return line && (photo || send)
  }

  private fun linePhotoStep(ocr: String, goal: String): Step {
    val o = ocr
    when {
      o.contains("送信") && (o.contains("取り消") || o.contains("完了") || o.contains("既読")) ->
        return Step(
          stepId = "line-done",
          displayText = "送れました。ほかにやることがなければ支援を終了できます。",
          voiceText = "写真が送れたようです。ほかにやることがなければ、通知かアプリから支援を終了してください。",
        )
      o.contains("送信") || o.contains("送る") ->
        return Step(
          stepId = "line-confirm-send",
          displayText = "内容を確かめてから「送信」を押してください。",
          voiceText = "写真と相手の名前を確かめてから、送信を押してください。よりそいAIは代わりに押しません。",
        )
      o.contains("アルバム") || o.contains("ギャラリー") || o.contains("画像を選択") ||
        o.contains("最近の項目") || o.contains("すべての写真") ->
        return Step(
          stepId = "line-pick-photo",
          displayText = "送りたい写真を一つ選んでください。",
          voiceText = "送りたい写真を一つだけ選んでください。選んだら次の案内を待ちます。",
        )
      o.contains("カメラ") && (o.contains("アルバム") || o.contains("画像") || o.contains("写真")) ->
        return Step(
          stepId = "line-choose-album",
          displayText = "「アルバム」や「画像」を選んでください。",
          voiceText = "カメラではなく、アルバムや画像を選んでください。孫に送る写真は、すでに撮ったものを使うことが多いです。",
        )
      o.contains("+") || o.contains("添付") || o.contains("アルバム") ||
        o.contains("ギャラリー") || (o.contains("写真") && o.contains("選択")) ->
        return Step(
          stepId = "line-open-attach",
          displayText = "写真を付けるボタン（＋など）を押してください。",
          voiceText = "トーク画面の、写真を付けるボタンやプラスを押してください。よりそいAIは代わりに押しません。",
        )
      o.contains("トーク") || o.contains("トークルーム") ||
        (o.contains("メッセージ") && !o.contains("ホーム")) ->
        return Step(
          stepId = "line-in-talk",
          displayText = "孫とのトークを開いたまま、写真ボタンを探してください。",
          voiceText = "孫とのトーク画面です。下のほうにある写真やプラスのボタンを探して押してください。",
        )
      o.contains("ホーム") || o.contains("友だち") || o.contains("チャット一覧") ->
        return Step(
          stepId = "line-pick-friend",
          displayText = "孫の名前のトークを開いてください。",
          voiceText = "友だち一覧から、孫の名前を選んでトークを開いてください。",
        )
      o.contains("LINE") || o.contains("ライン") || goal.contains("line") || goal.contains("ライン") ->
        return Step(
          stepId = "line-open",
          displayText = "まず LINE を開き、孫のトークを選んでください。",
          voiceText = "緑のLINEアプリを開き、孫の名前のトークを選んでください。開けたらそのままで大丈夫です。",
        )
      else ->
        return Step(
          stepId = "line-generic",
          displayText = "LINEで孫のトークを開き、写真を付けて送ります。",
          voiceText = "LINEで孫のトークを開き、写真を一つ選んでから送信してください。一度に一つです。勝手には送りません。",
        )
    }
  }
}
