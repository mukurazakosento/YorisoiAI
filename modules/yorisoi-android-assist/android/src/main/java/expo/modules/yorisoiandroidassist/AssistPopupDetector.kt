package expo.modules.yorisoiandroidassist

/**
 * Detects system / app dialogs from on-device OCR text only (MediaProjection frames).
 * Uses structure cues: question + permission topic + button labels.
 * Demo / heuristic only — not live AI. No auto-tap.
 */
object AssistPopupDetector {
  enum class PopupKind {
    PERMISSION_CAMERA,
    PERMISSION_MIC,
    PERMISSION_PHOTOS,
    PERMISSION_NOTIFICATIONS,
    PERMISSION_LOCATION,
    PERMISSION_CONTACTS,
    PERMISSION_FILES,
    PERMISSION_GENERIC,
    TERMS,
    UPDATE,
    INSTALL,
    UNKNOWN_DIALOG,
  }

  data class Detection(
    val kind: PopupKind,
    /** Stable fingerprint for dedupe (not raw OCR). */
    val fingerprint: String,
    val topicLabel: String,
    val buttons: List<String>,
    val excerpt: String,
  )

  fun detect(ocrText: String): Detection? {
    val raw = ocrText.trim()
    if (raw.length < 4) {
      return null
    }
    val n = normalize(raw)
    if (!looksLikeDialog(n)) {
      return null
    }

    val buttons = extractButtons(raw, n)
    val kind = classifyKind(n)
    val topic = topicLabelFor(kind, n)
    val excerpt = clip(raw, 160)
    val fingerprint = buildFingerprint(kind, topic, buttons)
    return Detection(
      kind = kind,
      fingerprint = fingerprint,
      topicLabel = topic,
      buttons = buttons,
      excerpt = excerpt,
    )
  }

  /** Require the same fingerprint across consecutive OCR samples before announce. */
  fun isStable(previousFingerprint: String?, current: Detection, streak: Int): Boolean {
    if (previousFingerprint != current.fingerprint) {
      return false
    }
    return streak >= 2
  }

  private fun looksLikeDialog(n: String): Boolean {
    val permissionCue =
      n.contains("許可") ||
        n.contains("アクセス") ||
        n.contains("使ってよろしい") ||
        n.contains("使用を許可")
    val termsCue =
      n.contains("利用規約") ||
        n.contains("プライバシー") ||
        n.contains("同意する") ||
        n.contains("同意して")
    val updateCue =
      n.contains("アップデート") ||
        n.contains("更新があります") ||
        n.contains("新しいバージョン") ||
        n.contains("インストール")
    val questionCue =
      n.contains("しますか") ||
        n.contains("よろしいですか") ||
        n.contains("いいですか") ||
        n.contains("？") ||
        n.contains("?")
    val buttonCue =
      n.contains("許可しない") ||
        n.contains("拒否") ||
        n.contains("キャンセル") ||
        n.contains("一度だけ") ||
        n.contains("アプリの使用中") ||
        n.contains("許可する") ||
        n.contains("同意")
    return (permissionCue && (questionCue || buttonCue)) ||
      (termsCue && buttonCue) ||
      (updateCue && (questionCue || buttonCue)) ||
      (permissionCue && buttonCue)
  }

  private fun classifyKind(n: String): PopupKind {
    return when {
      n.contains("カメラ") -> PopupKind.PERMISSION_CAMERA
      n.contains("マイク") || (n.contains("音声") && n.contains("録音")) -> PopupKind.PERMISSION_MIC
      n.contains("写真") || n.contains("画像") || n.contains("ギャラリー") || n.contains("メディア") ->
        PopupKind.PERMISSION_PHOTOS
      n.contains("通知") -> PopupKind.PERMISSION_NOTIFICATIONS
      n.contains("位置") || n.contains("gps") || n.contains("付近の") -> PopupKind.PERMISSION_LOCATION
      n.contains("連絡先") || n.contains("アドレス帳") -> PopupKind.PERMISSION_CONTACTS
      n.contains("ファイル") || n.contains("ストレージ") || n.contains("フォルダ") ->
        PopupKind.PERMISSION_FILES
      n.contains("利用規約") || n.contains("プライバシーポリシー") || n.contains("同意する") ->
        PopupKind.TERMS
      n.contains("アップデート") || n.contains("新しいバージョン") || n.contains("更新") ->
        PopupKind.UPDATE
      n.contains("インストール") -> PopupKind.INSTALL
      n.contains("許可") || n.contains("アクセス") -> PopupKind.PERMISSION_GENERIC
      else -> PopupKind.UNKNOWN_DIALOG
    }
  }

  private fun topicLabelFor(kind: PopupKind, n: String): String {
    return when (kind) {
      PopupKind.PERMISSION_CAMERA -> "カメラ"
      PopupKind.PERMISSION_MIC -> "マイク"
      PopupKind.PERMISSION_PHOTOS -> "写真・画像"
      PopupKind.PERMISSION_NOTIFICATIONS -> "通知"
      PopupKind.PERMISSION_LOCATION -> "位置情報"
      PopupKind.PERMISSION_CONTACTS -> "連絡先"
      PopupKind.PERMISSION_FILES -> "ファイル"
      PopupKind.PERMISSION_GENERIC ->
        when {
          n.contains("bluetooth") -> "Bluetooth"
          else -> "アプリの機能"
        }
      PopupKind.TERMS -> "利用規約・同意"
      PopupKind.UPDATE -> "アプリの更新"
      PopupKind.INSTALL -> "インストール"
      PopupKind.UNKNOWN_DIALOG -> "確認画面"
    }
  }

  private fun extractButtons(raw: String, n: String): List<String> {
    val found = mutableListOf<String>()
    val candidates =
      listOf(
        "許可しない",
        "許可する",
        "許可",
        "拒否",
        "キャンセル",
        "一度だけ",
        "今回のみ",
        "アプリの使用中のみ",
        "使用中のみ",
        "同意する",
        "同意しない",
        "後で",
        "今はしない",
        "更新",
        "インストール",
        "閉じる",
        "OK",
        "はい",
        "いいえ",
      )
    for (c in candidates) {
      if (raw.contains(c) || n.contains(normalize(c))) {
        if (c == "許可" && (found.contains("許可する") || found.contains("許可しない"))) {
          continue
        }
        found.add(c)
      }
    }
    return found.distinct().take(4)
  }

  private fun buildFingerprint(kind: PopupKind, topic: String, buttons: List<String>): String {
    return listOf(kind.name, topic, buttons.sorted().joinToString("|")).joinToString("#")
  }

  private fun clip(text: String, max: Int): String {
    val t = text.replace("\\s+".toRegex(), " ").trim()
    return if (t.length <= max) t else t.take(max) + "…"
  }

  private fun normalize(text: String): String {
    return text.lowercase().replace("\\s+".toRegex(), "")
  }
}
