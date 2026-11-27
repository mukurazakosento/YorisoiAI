package expo.modules.yorisoiandroidassist

/**
 * Uninstall-specialized elderly guidance (mirrors JS uninstallGuidance.ts).
 * No auto-tap / auto-uninstall / auto-confirm.
 * Ban hold-duration meta-advice ("don't count seconds").
 * Early step: go from Home to the screen that shows the app to remove.
 * go-home stall: after ~10s without OCR advance, continue to long-press guidance.
 */
object AssistUninstallGuidance {
  val GOAL_SUMMARY = "アプリをアンインストールしたい"

  /**
   * Stall timeout on uninstall-go-home (ms). Do not wait forever for perfect home OCR.
   * Ops cycle stays ~20s; FGS uses this as the next-poll delay while on go-home.
   */
  const val GO_HOME_STALL_TIMEOUT_MS = 10_000L

  /** Shared consequence explanation (menu + confirm). */
  const val CONSEQUENCE_VOICE =
    "メニューから削除を選ぶと、アプリをスマートフォンから取り除けます。アプリによっては、中に保存していた写真やメモなどが一緒に消えてしまう場合があります。消す前に、そのアプリの中に残しておきたいものがないか確認しましょう。"

  private val stageRank =
    mapOf(
      "uninstall-go-home" to 0,
      "uninstall-long-press" to 1,
      "uninstall-menu" to 2,
      "uninstall-confirm" to 3,
    )

  @Volatile private var lastStageId: String = ""
  @Volatile private var goHomeEnteredAtMs: Long = -1L

  fun reset() {
    lastStageId = ""
    goHomeEnteredAtMs = -1L
  }

  /**
   * Next capture delay: while on go-home, poll by the stall timeout (~10s)
   * so auto-advance can fire without waiting a full ~20s ops cycle.
   */
  fun nextPollDelayMs(stageId: String?, defaultIntervalMs: Long): Long {
    return if (normalizeStage(stageId) == "uninstall-go-home") {
      minOf(defaultIntervalMs, GO_HOME_STALL_TIMEOUT_MS)
    } else {
      defaultIntervalMs
    }
  }

  fun looksLikeUninstallGoal(goalNormalized: String): Boolean {
    val g = goalNormalized.replace("\\s+".toRegex(), "").lowercase()
    if (g.isEmpty()) return false
    if (
      g.contains("アンインストール") ||
      g.contains("uninstall") ||
      g.contains("アプリを消し") ||
      g.contains("アプリを削除") ||
      g.contains("アプリ削除") ||
      g.contains("アプリを消したい") ||
      g.contains("消したいアプリ") ||
      g.contains("アプリを消す") ||
      g.contains("アプリ消し")
    ) {
      return true
    }
    if (
      (g.contains("消し") || g.contains("削除")) &&
      (g.contains("アプリ") || g.contains("アイコン")) &&
      !g.contains("入れ") &&
      !g.contains("インストール")
    ) {
      return true
    }
    return false
  }

  fun buildStep(
    ocrNormalized: String,
    ocrRaw: String,
    nowMs: Long = System.currentTimeMillis(),
  ): AssistGuidanceRules.Step {
    val o = ocrNormalized
    val prev = normalizeStage(lastStageId)
    val ocrStage = matchStageFromOcr(o)
    var stage = resolveStage(ocrStage, prev)
    stage = applyGoHomeStallTimeout(stage, nowMs)
    val step = stepFor(stage, ocrRaw, o)
    lastStageId = step.stageId
    return step
  }

  /** Soft-advance when the same uninstall step repeats (anti-loop). */
  fun antiLoopStep(stuckStageId: String?): AssistGuidanceRules.Step {
    val stage = normalizeStage(stuckStageId) ?: "uninstall-long-press"
    return when (stage) {
      "uninstall-go-home" -> {
        goHomeEnteredAtMs = -1L
        lastStageId = "uninstall-long-press"
        val longPress = longPressStep()
        AssistGuidanceRules.Step(
          stepId = "uninstall-anti-loop-home",
          stageId = "uninstall-long-press",
          displayText = longPress.displayText,
          voiceText = longPress.voiceText,
          notifyText = longPress.notifyText,
        )
      }
      "uninstall-menu" ->
        AssistGuidanceRules.Step(
          stepId = "uninstall-anti-loop-menu",
          stageId = "uninstall-menu",
          displayText =
            "メニューの「削除」を選ぶ前に、残しておきたいものがないか確認しましょう。",
          voiceText =
            "$CONSEQUENCE_VOICE やめたければ「キャンセル」です。代わりには押しません。",
          notifyText = "「削除」をタップ",
        )
      "uninstall-confirm" ->
        AssistGuidanceRules.Step(
          stepId = "uninstall-anti-loop-confirm",
          stageId = "uninstall-confirm",
          displayText =
            "消す前に、残しておきたいものがないか確認しましょう。やめるなら「キャンセル」です。",
          voiceText =
            "$CONSEQUENCE_VOICE やめたければ「キャンセル」や「いいえ」を押してください。よりそいAIは代わりに押しません。",
          notifyText = "「削除」をタップ",
        )
      else ->
        AssistGuidanceRules.Step(
          stepId = "uninstall-anti-loop-long-press",
          stageId = "uninstall-long-press",
          displayText =
            "メニューが出たら「削除」や「アンインストール」を探してください。",
          voiceText =
            "同じ案内が続いています。長押しでメニューや小さな窓が出たら指を離し、「削除」や「アンインストール」を探してください。見えなければ、一度指を離してもう一度長押ししてみてください。代わりには消しません。",
          notifyText = "長押し",
        )
    }
  }

  private fun normalizeStage(value: String?): String? {
    if (value.isNullOrBlank()) return null
    return when (value) {
      "uninstall-go-home",
      "uninstall-find",
      "uninstall-find-app",
      -> "uninstall-go-home"
      "uninstall-long-press",
      "uninstall-menu",
      "uninstall-confirm",
      -> value
      else -> null
    }
  }

  private fun matchStageFromOcr(o: String): String {
    if (looksLikeConfirmDialog(o)) return "uninstall-confirm"
    if (looksLikeMenu(o)) return "uninstall-menu"
    if (looksLikeHomeOrAppList(o)) return "uninstall-long-press"
    return "uninstall-go-home"
  }

  private fun resolveStage(ocrStage: String, previous: String?): String {
    if (previous == null) return ocrStage
    val prevRank = stageRank[previous] ?: 0
    if (ocrStage == "uninstall-confirm" || ocrStage == "uninstall-menu") {
      return ocrStage
    }
    if (ocrStage == "uninstall-long-press") {
      if (prevRank >= (stageRank["uninstall-menu"] ?: 2)) {
        return previous
      }
      return "uninstall-long-press"
    }
    if (prevRank > (stageRank["uninstall-go-home"] ?: 0)) {
      return previous
    }
    return "uninstall-go-home"
  }

  /**
   * If still on go-home after ~10s with no OCR advance, continue to long-press.
   * Does not auto-tap; only advances spoken/notify guidance.
   */
  private fun applyGoHomeStallTimeout(stage: String, nowMs: Long): String {
    if (stage != "uninstall-go-home") {
      goHomeEnteredAtMs = -1L
      return stage
    }
    if (goHomeEnteredAtMs < 0L) {
      goHomeEnteredAtMs = nowMs
      return "uninstall-go-home"
    }
    if (nowMs - goHomeEnteredAtMs >= GO_HOME_STALL_TIMEOUT_MS) {
      goHomeEnteredAtMs = -1L
      return "uninstall-long-press"
    }
    return "uninstall-go-home"
  }

  private fun stepFor(stage: String, raw: String, o: String): AssistGuidanceRules.Step {
    return when (stage) {
      "uninstall-confirm" -> confirmConsequenceStep(raw, o)
      "uninstall-menu" -> tapDeleteStep(raw, o)
      "uninstall-long-press" -> longPressStep()
      else -> goHomeStep()
    }
  }

  private fun looksLikeConfirmDialog(o: String): Boolean {
    val ask =
      o.contains("しますか") ||
        o.contains("よろしい") ||
        o.contains("ほんとうに") ||
        o.contains("本当に") ||
        o.contains("取り消せ") ||
        o.contains("削除します") ||
        o.contains("アンインストールします")
    val del =
      o.contains("削除") || o.contains("アンインストール") || o.contains("消します")
    return ask && del
  }

  private fun looksLikeMenu(o: String): Boolean {
    return o.contains("アンインストール") ||
      o.contains("アプリ情報") ||
      (
        o.contains("削除") &&
          (
            o.contains("アプリ") ||
              o.contains("メニュー") ||
              o.contains("編集") ||
              o.contains("ウィジェット") ||
              o.contains("無効")
          )
      )
  }

  private fun looksLikeHomeOrAppList(o: String): Boolean {
    val cues =
      listOf(
        "google",
        "playストア",
        "playstore",
        "電話",
        "メッセージ",
        "設定",
        "カメラ",
        "クロック",
        "時計",
        "天気",
        "カレンダー",
        "chrome",
        "写真",
        "gmail",
        "youtube",
      )
    var hits = 0
    for (cue in cues) {
      if (o.contains(cue)) hits += 1
    }
    return hits >= 2
  }

  private fun goHomeStep(): AssistGuidanceRules.Step {
    return AssistGuidanceRules.Step(
      stepId = "uninstall-go-home",
      stageId = "uninstall-go-home",
      displayText = "ホーム画面から、消したいアプリのある画面まで行ってください。",
      voiceText =
        "ホーム画面から、消したいアプリのある画面まで行ってください。アプリの絵文字マークが見えるところです。よりそいAIは代わりに消しません。",
      notifyText = "ホームへ",
    )
  }

  private fun longPressStep(): AssistGuidanceRules.Step {
    return AssistGuidanceRules.Step(
      stepId = "uninstall-long-press",
      stageId = "uninstall-long-press",
      displayText = "消したいアプリを長押しして、メニューが出るまで待ってください。",
      voiceText =
        "消したいアプリのアイコンを指で長押ししてください。メニューや小さな窓が出るまで、そのまま押したままにしてください。メニューが出たら指を離してください。",
      notifyText = "長押し",
    )
  }

  private fun tapDeleteStep(raw: String, o: String): AssistGuidanceRules.Step {
    val label = pickDeleteLabel(raw, o)
    val quoted = if (label != null) "「$label」" else "「削除」や「アンインストール」"
    val notify =
      if (label != null) {
        AssistNotifyCopy.tap(label)
      } else {
        "「削除」をタップ"
      }
    return AssistGuidanceRules.Step(
      stepId = "uninstall-tap-delete",
      stageId = "uninstall-menu",
      displayText = "メニューから${quoted}を選ぶと、アプリをスマートフォンから取り除けます。",
      voiceText =
        "$CONSEQUENCE_VOICE 押すと確認の画面が出ることが多いです。まだ消えていません。代わりには押しません。",
      notifyText = notify,
    )
  }

  private fun confirmConsequenceStep(@Suppress("UNUSED_PARAMETER") raw: String, @Suppress("UNUSED_PARAMETER") o: String): AssistGuidanceRules.Step {
    return AssistGuidanceRules.Step(
      stepId = "uninstall-confirm-consequence",
      stageId = "uninstall-confirm",
      displayText =
        "消す前に、残しておきたいものがないか確認しましょう。やめるなら「キャンセル」です。",
      voiceText =
        "$CONSEQUENCE_VOICE やめたければ「キャンセル」や「いいえ」を押してください。よりそいAIは代わりに押しません。",
      notifyText = "「削除」をタップ",
    )
  }

  private fun pickDeleteLabel(raw: String, o: String): String? {
    val labels =
      listOf(
        "アンインストール",
        "削除",
        "アプリを削除",
        "このアプリを削除",
      )
    for (label in labels) {
      if (raw.contains(label) || o.contains(label.replace("\\s+".toRegex(), ""))) {
        return label
      }
    }
    if (o.contains("アンインストール")) return "アンインストール"
    if (o.contains("削除")) return "削除"
    return null
  }
}
