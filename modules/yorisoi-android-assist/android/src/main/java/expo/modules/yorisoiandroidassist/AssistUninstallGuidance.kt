package expo.modules.yorisoiandroidassist

/**
 * Uninstall-specialized elderly guidance (mirrors JS uninstallGuidance.ts).
 * No auto-tap / auto-uninstall / auto-confirm. Prefer outcome explanations over
 * "hold for N seconds" micromanagement.
 */
object AssistUninstallGuidance {
  val GOAL_SUMMARY = "アプリをアンインストールしたい"

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

  fun buildStep(ocrNormalized: String, ocrRaw: String): AssistGuidanceRules.Step {
    val o = ocrNormalized
    if (looksLikeConfirmDialog(o)) {
      return confirmConsequenceStep(ocrRaw, o)
    }
    if (looksLikeMenu(o)) {
      return tapDeleteStep(ocrRaw, o)
    }
    if (looksLikeHomeOrAppList(o)) {
      return longPressStep()
    }
    return findAppStep()
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
    return o.contains("google") ||
      o.contains("playストア") ||
      o.contains("電話") ||
      o.contains("メッセージ") ||
      o.contains("設定") ||
      o.contains("カメラ") ||
      o.contains("クロック") ||
      o.contains("天気") ||
      o.length > 8
  }

  private fun findAppStep(): AssistGuidanceRules.Step {
    return AssistGuidanceRules.Step(
      stepId = "uninstall-find-app",
      stageId = "uninstall-find",
      displayText = "消したいアプリが見える画面まで進んでください。",
      voiceText =
        "ホーム画面やアプリ一覧で、消したいアプリのアイコンが見えるところまで進んでください。よりそいAIは代わりに消しません。",
    )
  }

  private fun longPressStep(): AssistGuidanceRules.Step {
    return AssistGuidanceRules.Step(
      stepId = "uninstall-long-press",
      stageId = "uninstall-long-press",
      displayText = "消したいアプリを長押しして、メニューが出るまで待ってください。",
      voiceText =
        "消したいアプリのアイコンを指で長押ししてください。メニューや小さな窓が出るまで、そのまま押したままにしてください。何秒、と数えなくて大丈夫です。メニューが出たら指を離してください。",
    )
  }

  private fun tapDeleteStep(raw: String, o: String): AssistGuidanceRules.Step {
    val label = pickDeleteLabel(raw, o)
    val quoted = if (label != null) "「$label」" else "「削除」や「アンインストール」"
    return AssistGuidanceRules.Step(
      stepId = "uninstall-tap-delete",
      stageId = "uninstall-menu",
      displayText = "${quoted}を押してください。押すと確認の画面が出ることが多いです。",
      voiceText =
        "メニューの${quoted}を押してください。押すと「本当に削除しますか」などの確認が出ることが多いです。まだ消えていません。確認の画面で内容を読んでから、ご自身で進めてください。代わりには押しません。",
    )
  }

  private fun confirmConsequenceStep(raw: String, o: String): AssistGuidanceRules.Step {
    val label = pickDeleteLabel(raw, o) ?: "削除"
    return AssistGuidanceRules.Step(
      stepId = "uninstall-confirm-consequence",
      stageId = "uninstall-confirm",
      displayText = "「$label」を押すとアプリが消えます。やめるなら「キャンセル」です。",
      voiceText =
        "確認の画面です。「$label」や「OK」を押すと、このアプリが端末から消えます。あとでストアから入れ直せることも多いですが、アプリの中のデータが消えることもあります。やめたければ「キャンセル」や「いいえ」を押してください。よりそいAIは代わりに押しません。",
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
