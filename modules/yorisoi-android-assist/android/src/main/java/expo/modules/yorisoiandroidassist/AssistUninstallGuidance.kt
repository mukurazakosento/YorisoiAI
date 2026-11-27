package expo.modules.yorisoiandroidassist

/**
 * Uninstall-specialized elderly guidance (mirrors JS uninstallGuidance.ts).
 * No auto-tap / auto-uninstall / auto-confirm.
 *
 * 3 steps (notify ≤17 / TTS verbatim):
 * ① 消したいアプリを表示 → ~10s advance to long-press
 * ② アイコンを長押し → advance only when 「削除」 visible; else re-guide
 * ③ 削除項目を確認 → user taps themselves
 */
object AssistUninstallGuidance {
  val GOAL_SUMMARY = "アプリをアンインストールしたい"

  /**
   * Stall timeout on uninstall-go-home (ms). Do not wait forever for perfect home OCR.
   * Ops cycle stays ~20s; FGS uses this as the next-poll delay while on go-home.
   */
  const val GO_HOME_STALL_TIMEOUT_MS = 10_000L

  const val SHOW_APP_NOTIFY = "消したいアプリを表示"
  const val SHOW_APP_VOICE =
    "ホーム画面かアプリ一覧を開いて、消したいアプリが見えるところまで進んでください。見つからないときは、画面を左右にスクロールして探してください。"

  const val LONG_PRESS_NOTIFY = "アイコンを長押し"
  const val LONG_PRESS_VOICE =
    "消したいアプリのアイコンを指で押したままにしてください。アプリの近くに小さなメニューが表示されるまで押し続けてください。メニューが出たら指を離してください。"

  const val CONFIRM_DELETE_NOTIFY = "削除項目を確認"
  const val CONFIRM_DELETE_VOICE =
    "メニューにある削除の項目を確認してください。これを選ぶと、アプリがスマホから取り除かれます。アプリによっては、中に保存していた写真やメモ、記録なども一緒に消える場合があります。残しておきたいものがないか確認してください。削除してよければ、ご自身で削除の項目を押してください。"

  /** Shared step-③ TTS (export alias for older call sites / docs). */
  const val CONSEQUENCE_VOICE = CONFIRM_DELETE_VOICE

  private val stageRank =
    mapOf(
      "uninstall-go-home" to 0,
      "uninstall-long-press" to 1,
      "uninstall-menu" to 2,
      "uninstall-confirm" to 2,
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

  /** Soft-advance / re-guide when the same uninstall step repeats (anti-loop). */
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
      "uninstall-menu",
      "uninstall-confirm",
      -> {
        val confirm = confirmDeleteStep(stage)
        AssistGuidanceRules.Step(
          stepId = "uninstall-anti-loop-confirm",
          stageId = stage,
          displayText = confirm.displayText,
          voiceText = confirm.voiceText,
          notifyText = confirm.notifyText,
        )
      }
      else -> {
        val longPress = longPressStep()
        AssistGuidanceRules.Step(
          stepId = "uninstall-anti-loop-long-press",
          stageId = "uninstall-long-press",
          displayText = longPress.displayText,
          voiceText = longPress.voiceText,
          notifyText = longPress.notifyText,
        )
      }
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
    if (looksLikeDeleteLabelVisible(o)) {
      return if (looksLikeConfirmDialog(o)) "uninstall-confirm" else "uninstall-menu"
    }
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

  private fun stepFor(
    stage: String,
    @Suppress("UNUSED_PARAMETER") raw: String,
    @Suppress("UNUSED_PARAMETER") o: String,
  ): AssistGuidanceRules.Step {
    return when (stage) {
      "uninstall-confirm",
      "uninstall-menu",
      -> confirmDeleteStep(stage)
      "uninstall-long-press" -> longPressStep()
      else -> showAppStep()
    }
  }

  private fun looksLikeDeleteLabelVisible(o: String): Boolean {
    return o.contains("削除") || o.contains("アンインストール")
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
    return ask && looksLikeDeleteLabelVisible(o)
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

  private fun showAppStep(): AssistGuidanceRules.Step {
    return AssistGuidanceRules.Step(
      stepId = "uninstall-go-home",
      stageId = "uninstall-go-home",
      displayText = "消したいアプリが見えるところまで進んでください。",
      voiceText = SHOW_APP_VOICE,
      notifyText = SHOW_APP_NOTIFY,
    )
  }

  private fun longPressStep(): AssistGuidanceRules.Step {
    return AssistGuidanceRules.Step(
      stepId = "uninstall-long-press",
      stageId = "uninstall-long-press",
      displayText = "消したいアプリのアイコンを長押ししてください。",
      voiceText = LONG_PRESS_VOICE,
      notifyText = LONG_PRESS_NOTIFY,
    )
  }

  private fun confirmDeleteStep(stageId: String = "uninstall-menu"): AssistGuidanceRules.Step {
    val sid = if (stageId == "uninstall-confirm") "uninstall-confirm" else "uninstall-menu"
    return AssistGuidanceRules.Step(
      stepId =
        if (sid == "uninstall-confirm") {
          "uninstall-confirm-consequence"
        } else {
          "uninstall-tap-delete"
        },
      stageId = sid,
      displayText = "メニューの削除の項目を確認してから、ご自身で押してください。",
      voiceText = CONFIRM_DELETE_VOICE,
      notifyText = CONFIRM_DELETE_NOTIFY,
    )
  }
}
