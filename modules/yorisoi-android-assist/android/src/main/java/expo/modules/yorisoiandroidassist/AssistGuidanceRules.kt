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
    /**
     * Heads-up / FGS body: short essentials ≤17 chars (e.g. 「ホームへ」「長押し」).
     * Empty → AssistNotifyCopy derives from stage/display. TTS uses [voiceText].
     */
    val notifyText: String = "",
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
      // Background MediaProjection path: detect phone/email and advise without
      // asking the user to return to the Activity.
      val mode = AssistSafetyInspector.resolveMode(goalSummary)
      val finding = AssistSafetyInspector.inspect(mode, raw)
      if (finding != null) {
        return AssistSafetyInspector.toGuidanceStep(finding)
      }
      return AssistSafetyInspector.waitingStep(mode)
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
      return finalizeConcrete(linePhotoStep(o, raw), raw, goalSummary)
    }
    if (looksLikeWifiGoal(goal)) {
      return finalizeConcrete(wifiStep(o, raw), raw, goalSummary)
    }
    if (looksLikePhoneGoal(goal)) {
      return finalizeConcrete(phoneStep(o, raw), raw, goalSummary)
    }
    if (looksLikeEmailGoal(goal)) {
      return finalizeConcrete(emailStep(o, raw), raw, goalSummary)
    }
    if (looksLikeBrowserGoal(goal)) {
      return finalizeConcrete(browserStep(o, raw), raw, goalSummary)
    }
    if (looksLikeShoppingGoal(goal)) {
      return finalizeConcrete(shoppingStep(o, raw), raw, goalSummary)
    }
    if (looksLikePhotoPickerGoal(goal)) {
      return finalizeConcrete(photoPickerStep(o, raw), raw, goalSummary)
    }
    // Uninstall-specialized path (before generic install guidance).
    if (AssistUninstallGuidance.looksLikeUninstallGoal(goal)) {
      return finalizeConcrete(
        AssistUninstallGuidance.buildStep(o, raw),
        raw,
        goalSummary,
      )
    }
    if (looksLikeInstallGoal(goal)) {
      return finalizeConcrete(installStep(o, raw), raw, goalSummary)
    }
    if (looksLikeSettingsGoal(goal)) {
      return finalizeConcrete(settingsStep(o, raw, goal), raw, goalSummary)
    }

    return finalizeConcrete(ocrGroundedFallback(raw, goalSummary), raw, goalSummary)
  }

  private fun finalizeConcrete(step: Step, ocrRaw: String, goalSummary: String = ""): Step {
    val (display, voice, kind) =
      AssistConcreteGuidance.rewriteIfVague(
        step.displayText,
        step.voiceText,
        ocrRaw,
        scrollTarget = null,
        goal = goalSummary,
      )
    if (kind == "keep") {
      if (step.notifyText.isNotBlank()) {
        return step
      }
      return step.copy(
        notifyText =
          AssistNotifyCopy.resolve(
            notifyText = "",
            displayText = step.displayText,
            stageId = step.stageId,
            stepId = step.stepId,
          ),
      )
    }
    val notify =
      when (kind) {
        "scroll" ->
          AssistNotifyCopy.fromDisplayPatternsSafe(display) ?: AssistNotifyCopy.scroll()
        "tap" ->
          AssistNotifyCopy.fromDisplayPatternsSafe(display) ?: AssistNotifyCopy.tap("項目")
        "ask" ->
          AssistNotifyCopy.fromDisplayPatternsSafe(display) ?: "どちらを押す"
        else ->
          AssistNotifyCopy.resolve("", display, step.stageId, step.stepId)
      }
    return step.copy(
      stepId = if (kind == "scroll") "${step.stepId}-scroll" else step.stepId,
      displayText = display,
      voiceText = voice,
      notifyText = notify,
    )
  }

  fun unreadableStep(): Step {
    return Step(
      stepId = "ocr-unreadable",
      stageId = "unreadable",
      displayText = "画面をうまく読み取れませんでした。",
      voiceText = "画面をうまく読み取れませんでした。明るいところで、もう少し待つか、アプリに戻ってください。",
      notifyText = "読み取れず",
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
    return g.contains("設定") || g.contains("通知")
  }

  private fun looksLikeEmailGoal(g: String): Boolean {
    return g.contains("メール") || g.contains("gmail") || g.contains("メールを送")
  }

  private fun looksLikeBrowserGoal(g: String): Boolean {
    return g.contains("ブラウザ") || g.contains("chrome") || g.contains("ネットで") ||
      g.contains("ウェブ") || g.contains("ホームページ")
  }

  private fun looksLikeShoppingGoal(g: String): Boolean {
    return g.contains("買い物") || g.contains("購入") || g.contains("注文") ||
      g.contains("カート") || g.contains("アマゾン") || g.contains("楽天")
  }

  private fun looksLikePhotoPickerGoal(g: String): Boolean {
    return (g.contains("写真") || g.contains("画像") || g.contains("ファイル")) &&
      (g.contains("選") || g.contains("ピッカー") || g.contains("添付") || g.contains("ギャラリー"))
  }

  private fun looksLikeInstallGoal(g: String): Boolean {
    // Uninstall is AssistUninstallGuidance; keep this for install-only goals.
    if (AssistUninstallGuidance.looksLikeUninstallGoal(g)) {
      return false
    }
    return g.contains("アプリを入れ") || g.contains("インストール") ||
      g.contains("playストア") || g.contains("ストアで")
  }

  /** When goal is unclear: still cite OCR, never invent LINE photo steps. */
  private fun ocrGroundedFallback(raw: String, goalSummary: String): Step {
    val label = firstUiLabel(raw)
    if (label != null) {
      val hint = AssistConcreteGuidance.estimateRegion(raw, label)
      val (d, v) = AssistConcreteGuidance.tapTexts(label, hint.region, hint.ordinal)
      return Step(
        stepId = "ocr-tap-label",
        stageId = "ocr-grounded",
        displayText = d,
        voiceText = v,
      )
    }
    val (d, v) = AssistConcreteGuidance.choiceTexts(emptyList(), goalSummary.trim().take(16))
    return Step(
      stepId = "ask-clarify",
      stageId = "clarify",
      displayText = d,
      voiceText = v,
    )
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
      o.contains("設定") || o.contains("ネットワークとインターネット") -> {
        val wifiLabel =
          firstMatch(raw, listOf("Wi-Fi", "Wi‑Fi", "ネットワークとインターネット"))
        if (wifiLabel != null) {
          val hint = AssistConcreteGuidance.estimateRegion(raw, wifiLabel)
          val (d, v) = AssistConcreteGuidance.tapTexts(wifiLabel, hint.region, hint.ordinal, "接続")
          Step(
            stepId = "wifi-open-from-settings",
            stageId = "wifi-settings",
            displayText = d,
            voiceText = v,
          )
        } else {
          val (d, v) = AssistConcreteGuidance.scrollTexts("Wi-Fi", "下へ")
          Step(
            stepId = "wifi-scroll-for-label",
            stageId = "wifi-settings",
            displayText = d,
            voiceText = v,
          )
        }
      }
      else -> {
        if (raw.contains("設定")) {
          val hint = AssistConcreteGuidance.estimateRegion(raw, "設定")
          val (d, v) = AssistConcreteGuidance.tapTexts("設定", hint.region, hint.ordinal, "Wi-Fi")
          Step(stepId = "wifi-open", stageId = "wifi-start", displayText = d, voiceText = v)
        } else {
          val (d, v) = AssistConcreteGuidance.scrollTexts("設定", "下へ")
          Step(stepId = "wifi-open-scroll", stageId = "wifi-start", displayText = d, voiceText = v)
        }
      }
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

  private fun settingsStep(o: String, raw: String, goalNormalized: String): Step {
    val wantsNotify = goalNormalized.contains("通知") || o.contains("通知")
    if (o.contains("通知") && (o.contains("オン") || o.contains("オフ") || o.contains("許可"))) {
      val label = firstMatch(raw, listOf("通知", "オン", "オフ", "許可")) ?: "通知"
      val hint = AssistConcreteGuidance.estimateRegion(raw, label)
      val (d, v) = AssistConcreteGuidance.tapTexts(label, hint.region, hint.ordinal, "オンまたはオフ")
      return Step(
        stepId = "settings-notify-toggle",
        stageId = "settings-notify",
        displayText = d,
        voiceText = "$v オンとオフのどちらにするか、ご自身で決めてください。",
      )
    }
    if (wantsNotify) {
      if (raw.contains("通知")) {
        val hint = AssistConcreteGuidance.estimateRegion(raw, "通知")
        val (d, v) = AssistConcreteGuidance.tapTexts("通知", hint.region, hint.ordinal)
        return Step(
          stepId = "settings-notify",
          stageId = "settings-notify-list",
          displayText = d,
          voiceText = v,
        )
      }
      val (d, v) = AssistConcreteGuidance.scrollTexts("通知", "下へ")
      return Step(
        stepId = "settings-notify-scroll",
        stageId = "settings-home",
        displayText = d,
        voiceText = v,
      )
    }
    val preferred =
      listOf(
        "ネットワークとインターネット",
        "通知",
        "Wi-Fi",
        "Wi‑Fi",
        "アプリ",
        "電池",
        "ディスプレイ",
        "音",
        "セキュリティ",
        "システム",
        "設定",
      )
    for (label in preferred) {
      if (raw.contains(label)) {
        val hint = AssistConcreteGuidance.estimateRegion(raw, label)
        val (d, v) = AssistConcreteGuidance.tapTexts(label, hint.region, hint.ordinal)
        return Step(
          stepId = "settings-open",
          stageId = "settings-home",
          displayText = d,
          voiceText = v,
        )
      }
    }
    val scrollFor =
      when {
        goalNormalized.contains("wifi") || goalNormalized.contains("ワイファイ") -> "Wi-Fi"
        goalNormalized.contains("音") -> "音"
        goalNormalized.contains("アプリ") -> "アプリ"
        else -> "通知"
      }
    val (d, v) = AssistConcreteGuidance.scrollTexts(scrollFor, "下へ")
    return Step(
      stepId = "settings-open-scroll",
      stageId = "settings-home",
      displayText = d,
      voiceText = v,
    )
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
    val hint = AssistConcreteGuidance.estimateRegion(raw, seen)
    val where =
      if (hint.ordinal != null) {
        "画面の${hint.region}（上から${hint.ordinal}番目付近）の「$seen」"
      } else {
        "画面の${hint.region}あたりの「$seen」"
      }
    return Step(
      stepId = stepId,
      stageId = stageId,
      displayText = "${where}です。$display".take(120),
      voiceText = "いま${where}と見えます。$voice",
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
    val hint = AssistConcreteGuidance.estimateRegion(raw, label)
    val (d, v) = AssistConcreteGuidance.tapTexts(label, hint.region, hint.ordinal)
    return Step(
      stepId = "${generic.stepId}-ocr",
      stageId = generic.stageId,
      displayText = d,
      voiceText = v,
    )
  }

  private fun emailStep(o: String, raw: String): Step {
    return when {
      o.contains("送信") || o.contains("送る") ->
        step(
          "email-confirm-send",
          "email-pre-send",
          "宛先と内容を確かめてから「送信」を押してください。",
          "宛先と本文を確かめてから送信を押してください。代わりには送りません。",
          raw,
          listOf("送信", "送る"),
        )
      o.contains("作成") || o.contains("新規") || o.contains("書き込み") ->
        step(
          "email-compose",
          "email-compose",
          "宛先と用件を入れてください。",
          "メール作成画面です。宛先と用件を入れてください。代わりには入力しません。",
          raw,
          listOf("作成", "新規", "宛先"),
        )
      o.contains("受信") || o.contains("受信トレイ") || o.contains("inbox") ->
        step(
          "email-inbox",
          "email-inbox",
          "開きたいメールを一つ選んでください。",
          "受信トレイから、開きたいメールを一つ選んでください。",
          raw,
          listOf("受信", "受信トレイ"),
        )
      else ->
        ocrGroundedOr(
          raw,
          Step(
            stepId = "email-open",
            stageId = "email-start",
            displayText = "メールアプリを開いてください。",
            voiceText = "メールアプリを開き、やりたい画面まで進めてください。",
          ),
        )
    }
  }

  private fun browserStep(o: String, raw: String): Step {
    return when {
      o.contains("検索") || o.contains("google") || o.contains("アドレス") ->
        step(
          "browser-search",
          "browser-search",
          "調べたい言葉を入れて検索してください。",
          "検索欄に調べたい言葉を入れてください。代わりには入力しません。",
          raw,
          listOf("検索", "Google"),
        )
      o.contains("タブ") || o.contains("ブックマーク") ->
        step(
          "browser-nav",
          "browser-nav",
          "開きたいページを一つ選んでください。",
          "タブやブックマークから、開きたいページを一つ選んでください。",
          raw,
          listOf("タブ", "ブックマーク"),
        )
      else ->
        ocrGroundedOr(
          raw,
          Step(
            stepId = "browser-open",
            stageId = "browser-start",
            displayText = "ブラウザを開いてください。",
            voiceText = "ブラウザを開き、調べたいページへ進めてください。",
          ),
        )
    }
  }

  private fun shoppingStep(o: String, raw: String): Step {
    return when {
      o.contains("購入") || o.contains("注文を確定") || o.contains("支払い") ->
        step(
          "shop-confirm-pay",
          "shop-pay",
          "金額と届け先を確かめてから、ご自身で進めてください。",
          "購入や支払いは、内容を確かめてからご自身で押してください。代わりには買いません。",
          raw,
          listOf("購入", "注文を確定", "支払い"),
        )
      o.contains("カート") || o.contains("かご") ->
        step(
          "shop-cart",
          "shop-cart",
          "カートの中身を確かめてください。",
          "カートの商品を確かめてください。購入は急がなくて大丈夫です。",
          raw,
          listOf("カート", "かご"),
        )
      o.contains("検索") || o.contains("商品") ->
        step(
          "shop-browse",
          "shop-browse",
          "見たい商品を一つ選んでください。",
          "一覧から見たい商品を一つ選んでください。",
          raw,
          listOf("検索", "商品"),
        )
      else ->
        ocrGroundedOr(
          raw,
          Step(
            stepId = "shop-open",
            stageId = "shop-start",
            displayText = "買い物アプリを開いてください。",
            voiceText = "買い物アプリを開き、見たい商品まで進めてください。購入はご自身で確認してから。",
          ),
        )
    }
  }

  private fun photoPickerStep(o: String, raw: String): Step {
    return when {
      o.contains("アルバム") || o.contains("ギャラリー") || o.contains("最近の項目") ||
        o.contains("すべての写真") || o.contains("ファイル") || o.contains("ドキュメント") ->
        step(
          "picker-choose",
          "picker-grid",
          "送りたい写真やファイルを一つ選んでください。",
          "一覧から、使いたい写真やファイルを一つだけ選んでください。",
          raw,
          listOf("アルバム", "ギャラリー", "最近の項目", "ファイル", "ドキュメント"),
        )
      o.contains("許可") ->
        step(
          "picker-permission",
          "picker-permission",
          "写真へのアクセスを、必要な方だけ選んでください。",
          "写真やファイルへの許可画面です。必要な方を、ご自身で選んでください。代わりには押しません。",
          raw,
          listOf("許可する", "許可しない", "写真"),
        )
      else ->
        ocrGroundedOr(
          raw,
          Step(
            stepId = "picker-open",
            stageId = "picker-start",
            displayText = "写真やファイルを選ぶ画面を開いてください。",
            voiceText = "写真やファイルを選ぶ画面を開いて、一つ選んでください。",
          ),
        )
    }
  }

  private fun installStep(o: String, raw: String): Step {
    return when {
      o.contains("インストール") || o.contains("入手") || o.contains("更新") ->
        step(
          "install-confirm",
          "install-confirm",
          "アプリ名を確かめてから「インストール」を押してください。",
          "アプリの名前を確かめてから、インストールを押してください。代わりには押しません。",
          raw,
          listOf("インストール", "入手", "更新"),
        )
      o.contains("play") || o.contains("ストア") || o.contains("検索") ->
        step(
          "install-search",
          "install-store",
          "入れたいアプリの名前を検索してください。",
          "ストアで入れたいアプリの名前を検索し、正しいものを選んでください。",
          raw,
          listOf("検索", "ストア"),
        )
      else ->
        ocrGroundedOr(
          raw,
          Step(
            stepId = "install-open",
            stageId = "install-start",
            displayText = "Playストアを開いてください。",
            voiceText = "Playストアを開き、入れたいアプリを探してください。",
          ),
        )
    }
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
        "インストール",
        "購入",
        "注文",
        "カート",
        "検索",
        "履歴",
        "ファイル",
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
