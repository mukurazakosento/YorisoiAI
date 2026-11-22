package expo.modules.yorisoiandroidassist

/**
 * Builds grounded popup explanations from detector output + OCR excerpt.
 * Structure: what / why / buttons / outcomes / caution.
 * Neutral when unsure. Never auto-tap. Demo mode only.
 */
object AssistPopupExplainer {
  fun explain(detection: AssistPopupDetector.Detection): AssistGuidanceRules.Step {
    val sensitive = AssistSecretRedactor.containsSensitive(detection.excerpt)
    val buttons = detection.buttons
    val buttonPhrase =
      if (buttons.isEmpty()) {
        "画面下のボタンをよく見てください。"
      } else {
        "ボタンは「${buttons.joinToString("」「")}」などです。"
      }

    val (what, why, outcomes, caution) = contentFor(detection)

    val display =
      listOf(what, buttonPhrase, caution)
        .joinToString(" ")
        .take(120)

    val voiceRaw =
      buildString {
        append(what)
        append(why)
        append(buttonPhrase)
        append(outcomes)
        append(caution)
        append("よりそいAIは代わりに押しません。")
        if (sensitive) {
          append("パスワードや番号は読み上げません。")
        }
      }

    val voice = AssistSecretRedactor.forVoice(voiceRaw)
    val stepId = "popup-${detection.fingerprint.hashCode().toUInt()}"
    return AssistGuidanceRules.Step(
      stepId = stepId,
      stageId = "popup-${detection.kind.name.lowercase()}",
      displayText = display,
      voiceText = voice,
      mode = "demo",
    )
  }

  /**
   * Text-explanation path when no clear dialog: summarize OCR grounded text.
   */
  fun explainScreenText(ocrText: String): AssistGuidanceRules.Step {
    val raw = ocrText.trim().replace("\\s+".toRegex(), " ")
    if (raw.isEmpty()) {
      return AssistGuidanceRules.unreadableStep()
    }
    if (AssistSecretRedactor.containsSensitive(raw)) {
      return AssistGuidanceRules.Step(
        stepId = "explain-sensitive",
        stageId = "explain-sensitive",
        displayText = "秘密の文字があるので詳しく読み上げません。",
        voiceText = "パスワードや番号らしき文字があるので、詳しくは読み上げません。自分の目で確認してください。",
        mode = "demo",
      )
    }
    val clipped = if (raw.length > 80) raw.take(80) + "…" else raw
    val detection = AssistPopupDetector.detect(raw)
    if (detection != null) {
      return explain(detection)
    }
    return AssistGuidanceRules.Step(
      stepId = "explain-ocr-${clipped.hashCode().toUInt()}",
      stageId = "explain-screen",
      displayText = "画面には「${clipped.take(40)}」とあります。",
      voiceText = "いまの画面の文字は、だいたい次のとおりです。「${AssistSecretRedactor.forVoice(clipped)}」。分からなければアプリに戻って聞いてください。代わりには操作しません。",
      mode = "demo",
    )
  }

  private data class Parts(
    val what: String,
    val why: String,
    val outcomes: String,
    val caution: String,
  )

  private fun contentFor(d: AssistPopupDetector.Detection): Parts {
    return when (d.kind) {
      AssistPopupDetector.PopupKind.PERMISSION_CAMERA ->
        Parts(
          what = "カメラを使ってよいか聞いている画面です。",
          why = "写真や動画を撮る機能に必要です。",
          outcomes = "許可するとカメラが使えます。許可しないとその機能は使えません。",
          caution = "知らないアプリなら急がなくて大丈夫です。",
        )
      AssistPopupDetector.PopupKind.PERMISSION_MIC ->
        Parts(
          what = "マイクを使ってよいか聞いている画面です。",
          why = "音声入力や通話に使うことがあります。",
          outcomes = "許可するとマイクが使えます。不要なら許可しなくて構いません。",
          caution = "分からなければ「許可しない」でも大丈夫です。",
        )
      AssistPopupDetector.PopupKind.PERMISSION_PHOTOS ->
        Parts(
          what = "写真や画像へのアクセスを聞いている画面です。",
          why = "アルバムから画像を選ぶときに使います。",
          outcomes = "許可すると写真を選べます。許可しないと選べません。",
          caution = "必要なときだけ許可すれば十分です。",
        )
      AssistPopupDetector.PopupKind.PERMISSION_NOTIFICATIONS ->
        Parts(
          what = "通知を送ってよいか聞いている画面です。",
          why = "お知らせやメッセージの着信表示に使います。",
          outcomes = "許可すると通知が届きます。許可しないと画面を開くまで気づきにくいです。",
          caution = "たくさん来ると疲れることもあるので、必要か考えてください。",
        )
      AssistPopupDetector.PopupKind.PERMISSION_LOCATION ->
        Parts(
          what = "位置情報を使ってよいか聞いている画面です。",
          why = "地図や近くの情報に使うことがあります。",
          outcomes = "許可すると位置が伝わります。不要なら許可しなくて構いません。",
          caution = "知らないアプリには特に慎重に。",
        )
      AssistPopupDetector.PopupKind.PERMISSION_CONTACTS ->
        Parts(
          what = "連絡先へのアクセスを聞いている画面です。",
          why = "友だちを探す機能などに使うことがあります。",
          outcomes = "許可すると連絡先が読めます。不要なら拒否して大丈夫です。",
          caution = "本当に必要か分からなければ許可を急がないでください。",
        )
      AssistPopupDetector.PopupKind.PERMISSION_FILES ->
        Parts(
          what = "ファイルやストレージへのアクセスを聞いている画面です。",
          why = "保存や読み込みに使うことがあります。",
          outcomes = "許可するとファイルに触れます。不要なら許可しなくて構いません。",
          caution = "目的が分からなければ「許可しない」で大丈夫です。",
        )
      AssistPopupDetector.PopupKind.PERMISSION_GENERIC ->
        Parts(
          what = "「${d.topicLabel}」の利用許可を聞いている画面です。",
          why = "アプリがその機能を使うための確認です。",
          outcomes = "許可するとその機能が使えます。拒否すると使えません。",
          caution = "断定はしません。分からなければ拒否でも構いません。",
        )
      AssistPopupDetector.PopupKind.TERMS ->
        Parts(
          what = "利用規約や同意の確認画面です。",
          why = "サービス利用の条件に同意するかを聞いています。",
          outcomes = "同意すると先へ進めます。同意しないと使えないことが多いです。",
          caution = "内容が読めないときは、急いで同意しなくて大丈夫です。",
        )
      AssistPopupDetector.PopupKind.UPDATE ->
        Parts(
          what = "アプリの更新を進める確認画面です。",
          why = "新しい版に入れ替えるかを聞いています。",
          outcomes = "更新すると新しい機能や修正が入ることがあります。",
          caution = "通信中や充電切れに注意してください。急かされても慌てないでください。",
        )
      AssistPopupDetector.PopupKind.INSTALL ->
        Parts(
          what = "アプリを入れてよいかの確認画面です。",
          why = "端末にアプリを追加するかを聞いています。",
          outcomes = "入れるとホームに追加されます。入れなければ追加されません。",
          caution = "何のアプリか分からなければ、入れないでください。",
        )
      AssistPopupDetector.PopupKind.UNKNOWN_DIALOG ->
        Parts(
          what = "何かを確認する画面のようです。",
          why = "はっきりした種類までは読み取れませんでした。",
          outcomes = "ボタンを押す前に、文言をもう一度見てください。",
          caution = "推測では断定しません。分からなければキャンセルや戻るを選んでください。",
        )
    }
  }
}
