package expo.modules.yorisoiandroidassist

/**
 * Concrete ops copy: quote visible labels, say where on screen, scroll to find
 * named items. Reject vague 「直したい設定を開いて」 style delegation.
 */
object AssistConcreteGuidance {
  private val vaguePhrase =
    Regex(
      "直したい項目|直したい設定|適切な項目|好きな項目|任意の項目|必要な項目|" +
        "設定を開いて|やりたい画面まで|見たい商品まで|確認したい番号が出るところまで|" +
        "一つ開いてください|項目を選んで",
    )

  fun isVague(text: String): Boolean {
    val t = text.replace("\\s+".toRegex(), "")
    if (t.isEmpty()) return true
    if (vaguePhrase.containsMatchIn(t)) return true
    if (t.contains("設定を開") && !text.contains("「")) return true
    return false
  }

  data class RegionHint(val region: String, val ordinal: Int?)

  fun estimateRegion(raw: String, label: String): RegionHint {
    val lines =
      raw.split(Regex("[\\n\\r]+"))
        .map { it.trim() }
        .filter { it.isNotEmpty() }
    if (lines.size >= 2) {
      val idx = lines.indexOfFirst { it.contains(label) }
      if (idx >= 0) {
        val frac = if (lines.size <= 1) 0.5 else idx.toDouble() / (lines.size - 1)
        val region =
          when {
            frac < 0.33 -> "上"
            frac > 0.66 -> "下"
            else -> "中央"
          }
        return RegionHint(region, idx + 1)
      }
    }
    when (label) {
      "許可しない", "キャンセル" -> return RegionHint("左", null)
      "許可する", "同意する" -> return RegionHint("右", null)
      "送信", "送る" -> return RegionHint("下", null)
    }
    val blob = raw.replace("\\s+".toRegex(), " ").trim()
    val at = blob.indexOf(label)
    if (at < 0) return RegionHint("中央", null)
    val frac = if (blob.length <= 1) 0.5 else at.toDouble() / (blob.length - 1)
    val region =
      when {
        frac < 0.33 -> "上"
        frac > 0.66 -> "下"
        else -> "中央"
      }
    return RegionHint(region, null)
  }

  fun tapTexts(label: String, region: String, ordinal: Int?, lookFor: String? = null): Pair<String, String> {
    val where =
      if (ordinal != null) {
        "画面の${region}あたり（上から${ordinal}番目付近）の"
      } else {
        "画面の${region}あたりの"
      }
    val display = "${where}「$label」を押してください。".take(120)
    val look =
      if (!lookFor.isNullOrBlank()) {
        "次に「${lookFor.trim()}」が出るか見てください。"
      } else {
        "一度に一つです。代わりには押しません。"
      }
    val voice = "${where}「$label」を一つ押してください。$look".take(240)
    return display to voice
  }

  fun scrollTexts(lookFor: String, direction: String = "下へ"): Pair<String, String> {
    val label = lookFor.trim().ifEmpty { "目的の項目" }
    val display = "画面を${direction}ゆっくりスワイプして、「$label」を探してください。".take(120)
    val voice =
      "指で画面を${direction}、少しだけスワイプしてください。「$label」が見えたら教えてください。一度に少しずつです。"
        .take(240)
    return display to voice
  }

  fun choiceTexts(labels: List<String>, goalBit: String = ""): Pair<String, String> {
    val a = labels.getOrNull(0)
    val b = labels.getOrNull(1)
    if (a != null && b != null) {
      return "次は「$a」と「$b」のどちらを押しますか？".take(120) to
        "画面に「$a」と「$b」が見えます。${if (goalBit.isNotEmpty()) "「$goalBit」なら、" else ""}どちらを一つ押しますか？"
          .take(240)
    }
    if (a != null) {
      return "画面の「$a」を押しますか？".take(120) to
        "いま「$a」と見えます。これを押してよいですか？ いいえなら、見える文字を教えてください。"
          .take(240)
    }
    return "画面の上・中央・下のどれに文字がありますか？" to
      "画面をうまく特定できません。上・中央・下のどこに文字が見えますか？一つ教えてください。"
  }

  fun rewriteIfVague(
    display: String,
    voice: String,
    ocrText: String,
    preferred: List<String> = emptyList(),
    scrollTarget: String? = null,
    goal: String = "",
  ): Triple<String, String, String> {
    // Returns display, voice, actionKind (tap|scroll|ask|keep)
    if (!isVague("$display\n$voice")) {
      return Triple(display, voice, "keep")
    }
    val prefs =
      if (preferred.isNotEmpty()) {
        preferred
      } else {
        listOf(
          "通知", "Wi-Fi", "Wi‑Fi", "ネットワークとインターネット", "アプリ", "電池",
          "ディスプレイ", "音", "セキュリティ", "許可する", "許可しない", "送信",
          "アルバム", "トーク", "設定",
        )
      }
    for (label in prefs) {
      if (ocrText.contains(label)) {
        val hint = estimateRegion(ocrText, label)
        val (d, v) = tapTexts(label, hint.region, hint.ordinal)
        return Triple(d, v, "tap")
      }
    }
    val scrollFor = scrollTarget?.trim().orEmpty()
    if (scrollFor.isNotEmpty()) {
      val (d, v) = scrollTexts(scrollFor, "下へ")
      return Triple(d, v, "scroll")
    }
    val visible = prefs.filter { ocrText.contains(it) }.take(2)
    val (d, v) = choiceTexts(visible, goal.take(16))
    return Triple(d, v, "ask")
  }
}
