package expo.modules.yorisoiandroidassist

import org.json.JSONObject

/**
 * Native operation-support planner.
 * Uses on-device LLM when [AssistLlmBridge.isReady]; otherwise heuristic rules.
 * Actions are advice only — never auto-tap / send / call / purchase.
 */
object AssistOperationPlanner {
  data class ScreenSnap(
    val goalSummary: String,
    val ocrText: String,
    val a11yText: String = "",
    val packageName: String = "",
    val appName: String = "",
    val dialogPresent: Boolean = false,
    val dialogButtons: List<String> = emptyList(),
    val lastGuidedAction: String = "",
    val userAnswer: String = "",
    val previousOcr: String = "",
  )

  private val recentStepIds = ArrayDeque<String>()
  private const val MAX_HISTORY = 8

  fun resetHistory() {
    recentStepIds.clear()
    AssistUninstallGuidance.reset()
  }

  fun plan(
    featureId: String,
    snap: ScreenSnap,
    ocrChanged: Boolean,
  ): AssistGuidanceRules.Step {
    if (featureId != "operationSupport") {
      return AssistGuidanceRules.buildNextStep(featureId, snap.goalSummary, snap.ocrText)
    }

    val safeOcr = AssistSecretRedactor.forPublicText(snap.ocrText)
    val safeA11y = AssistSecretRedactor.forPublicText(snap.a11yText)
    val evidence = (safeOcr + " " + safeA11y).trim()

    if (evidence.isEmpty()) {
      return AssistGuidanceRules.unreadableStep()
    }

    if (AssistLlmBridge.isReady()) {
      val llmStep = tryLlmPlan(snap, evidence)
      if (llmStep != null) {
        return antiLoop(llmStep, ocrChanged)
      }
    }

    return antiLoop(
      AssistGuidanceRules.buildNextStep(featureId, snap.goalSummary, evidence),
      ocrChanged,
    )
  }

  private fun antiLoop(
    step: AssistGuidanceRules.Step,
    ocrChanged: Boolean,
  ): AssistGuidanceRules.Step {
    val sameCount = recentStepIds.count { it == step.stepId }
    val uninstallStuck =
      step.stepId.startsWith("uninstall-") || step.stageId.startsWith("uninstall-")
    // Uninstall: trip even when OCR flickers; other paths keep the quiet-OCR gate.
    val shouldTrip =
      sameCount >= 2 && (uninstallStuck || !ocrChanged)
    if (shouldTrip) {
      val ask =
        if (uninstallStuck) {
          AssistUninstallGuidance.antiLoopStep(step.stageId).copy(mode = step.mode)
        } else {
          AssistGuidanceRules.Step(
            stepId = "anti-loop-ask",
            stageId = "anti-loop",
            displayText = "同じ案内が続いています。次に押す場所を一つ教えてください。",
            voiceText =
              "同じ案内が続いています。次に押す場所を一つだけ教えてください。代わりには押しません。",
            mode = step.mode,
            notifyText = "次を教えて",
          )
        }
      pushHistory(ask.stepId)
      return ask
    }
    pushHistory(step.stepId)
    return step
  }

  private fun pushHistory(stepId: String) {
    recentStepIds.addLast(stepId)
    while (recentStepIds.size > MAX_HISTORY) {
      recentStepIds.removeFirst()
    }
  }

  private fun tryLlmPlan(snap: ScreenSnap, evidence: String): AssistGuidanceRules.Step? {
    val prompt =
      buildString {
        appendLine("あなたは高齢者向けスマホ支援の操作計画です。JSONのみ。自動操作禁止。")
        appendLine("根拠に無いボタンは出さない。displayTextは「ラベル」引用＋位置（上/下/左/右/中央）。")
        appendLine("禁止: 直したい設定を開いて／適切な項目を選んで、など曖昧な委任。")
        appendLine("対象が無いときは scrollDirection=下へ で探す文字を lookFor に書く。")
        appendLine("不明なら具体的な二択か Yes/No。")
        appendLine(
          """形式: {"stage":"","actionKind":"tap|scroll|ask","targetButtonText":null,"screenRegion":null,"scrollDirection":null,"lookFor":null,"confidence":0.0,"displayText":"","voiceText":"","stepId":"","requiresUserConfirm":false}""",
        )
        appendLine("目標: ${AssistSecretRedactor.forPublicText(snap.goalSummary)}")
        appendLine("アプリ: ${snap.appName} / ${snap.packageName}")
        appendLine("ダイアログ: ${snap.dialogPresent} ボタン=${snap.dialogButtons.joinToString(",")}")
        appendLine("画面文字: $evidence")
        appendLine("直前案内: ${snap.lastGuidedAction}")
        appendLine("利用者返答: ${snap.userAnswer}")
      }

    val raw = AssistLlmBridge.generate(prompt) ?: return null
    return parseGrounded(raw, evidence)
  }

  private fun parseGrounded(raw: String, evidence: String): AssistGuidanceRules.Step? {
    val jsonText = extractJson(raw) ?: return unsureStep()
    return try {
      val obj = JSONObject(jsonText)
      val target = obj.optString("targetButtonText", "").trim()
      val lookFor = obj.optString("lookFor", "").trim().ifBlank { target }
      val confidence = obj.optDouble("confidence", 0.4)
      var display =
        AssistSecretRedactor.forPublicText(obj.optString("displayText", "").trim())
      var voice =
        AssistSecretRedactor.forPublicText(obj.optString("voiceText", display).trim())
      val stage = obj.optString("stage", "llm").ifBlank { "llm" }
      var stepId = obj.optString("stepId", "").ifBlank { "llm-$stage" }
      val requiresConfirm = obj.optBoolean("requiresUserConfirm", false)
      val actionKind = obj.optString("actionKind", "tap").trim().lowercase()

      if (display.isBlank()) {
        return unsureStep()
      }
      if (confidence < 0.35) {
        return unsureStep()
      }
      val targetVisible =
        target.isNotEmpty() &&
          evidence.replace("\\s+".toRegex(), "").contains(target.replace("\\s+".toRegex(), ""))
      if (target.isNotEmpty() && !targetVisible) {
        val (d, v) = AssistConcreteGuidance.scrollTexts(lookFor.ifBlank { target }, "下へ")
        return AssistGuidanceRules.Step(
          stepId = "scroll-for-${target.take(12)}".take(64),
          stageId = "scroll",
          displayText = d,
          voiceText = v,
          mode = "live",
          notifyText = AssistNotifyCopy.scroll(lookFor.ifBlank { target }),
        )
      }
      if (AssistConcreteGuidance.isVague("$display\n$voice")) {
        if (actionKind == "scroll" || obj.optString("scrollDirection").isNotBlank()) {
          val dir = obj.optString("scrollDirection", "下へ").ifBlank { "下へ" }
          val (d, v) = AssistConcreteGuidance.scrollTexts(lookFor.ifBlank { "目的の項目" }, dir)
          display = d
          voice = v
          stepId = "$stepId-scroll"
        } else if (targetVisible) {
          val hint = AssistConcreteGuidance.estimateRegion(evidence, target)
          val (d, v) = AssistConcreteGuidance.tapTexts(target, hint.region, hint.ordinal, lookFor)
          display = d
          voice = v
        } else {
          val (d, v, kind) =
            AssistConcreteGuidance.rewriteIfVague(
              display,
              voice,
              evidence,
              scrollTarget = lookFor.ifBlank { null },
            )
          display = d
          voice = v
          if (kind != "keep") {
            stepId = "$stepId-$kind"
          }
        }
      } else if (targetVisible && !display.contains(target)) {
        val hint = AssistConcreteGuidance.estimateRegion(evidence, target)
        val (d, v) = AssistConcreteGuidance.tapTexts(target, hint.region, hint.ordinal, lookFor)
        display = d
        voice = v
      }
      if (requiresConfirm || SENSITIVE.containsMatchIn(display + target)) {
        display = "確認してから進めてください。$display".take(120)
        voice =
          "送信や許可の変更は、ご自身で確認してから行ってください。$voice 代わりには操作しません。"
        stepId = "$stepId-confirm"
      }

      AssistGuidanceRules.Step(
        stepId = stepId.take(64),
        stageId = stage.take(40),
        displayText = display.take(120),
        voiceText = voice.take(240),
        mode = "live",
        notifyText =
          AssistNotifyCopy.resolve(
            notifyText = "",
            displayText = display,
            stageId = stage,
            stepId = stepId,
          ),
      )
    } catch (_: Exception) {
      unsureStep()
    }
  }

  private fun unsureStep(extra: String? = null): AssistGuidanceRules.Step {
    val display = extra ?: "画面を判断できませんでした"
    return AssistGuidanceRules.Step(
      stepId = "unsure-llm",
      stageId = "unsure",
      displayText = display.take(120),
      voiceText =
        if (extra != null) {
          "$extra 代わりには操作しません。"
        } else {
          "画面を判断できませんでした。もう一度画面を見せるか、やりたいことを短く教えてください。代わりには操作しません。"
        },
      mode = "live",
      notifyText = "判断できません",
    )
  }

  private fun extractJson(raw: String): String? {
    val start = raw.indexOf('{')
    val end = raw.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    return raw.substring(start, end + 1)
  }

  private val SENSITIVE =
    Regex("送信|送る|発信|購入|注文|決済|支払い|許可する|許可しない|削除|アンインストール")
}
