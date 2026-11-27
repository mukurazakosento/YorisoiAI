/**
 * Heads-up / local instruction notify bodies must be short action-only lines
 * (≤17 Japanese chars), e.g. 「通知」をタップ / 長押し.
 * Do not ship long prose and truncate into gibberish — author or derive a minimal line.
 * Mirrors AssistNotifyCopy + AssistNotifier.MAX_INSTRUCTION_CHARS.
 *
 * TTS / in-app displayText stay the fuller pre-#35/#36 spoken baseline
 * (restore ref: 88d07c7 / PR #34 tip) at the call site — never reuse this notify line as voiceText.
 */

export const MAX_INSTRUCTION_NOTIFY_CHARS = 17;

/** Safety-net truncate (ellipsis). Prefer resolveMinimalNotifyInstruction. */
export function truncateInstructionNotifyText(
  text: string,
  maxChars: number = MAX_INSTRUCTION_NOTIFY_CHARS,
): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  if (maxChars <= 1) {
    return trimmed.slice(0, maxChars);
  }
  return `${trimmed.slice(0, maxChars - 1)}…`;
}

/** 「ラベル」をタップ — action-only notify (≤17). */
export function tapNotify(label: string): string {
  const cleaned = label.trim() || '項目';
  const candidate = `「${cleaned}」をタップ`;
  if (candidate.length <= MAX_INSTRUCTION_NOTIFY_CHARS) {
    return candidate;
  }
  // 「」をタップ = 6 chars overhead
  const budget = MAX_INSTRUCTION_NOTIFY_CHARS - 6;
  if (budget >= 2) {
    return `「${cleaned.slice(0, budget)}」をタップ`;
  }
  return '項目をタップ';
}

/** 長押し — or 「ラベル」長押し when a short label fits. */
export function longPressNotify(label = ''): string {
  const cleaned = label.trim();
  if (cleaned) {
    const candidate = `「${cleaned}」長押し`;
    if (candidate.length <= MAX_INSTRUCTION_NOTIFY_CHARS) {
      return candidate;
    }
  }
  return MINIMAL_NOTIFY_SAMPLES.longPress;
}

export function scrollNotify(lookFor = '', direction = '下へ'): string {
  const label = lookFor.trim();
  if (label) {
    const candidate = `「${label}」を探す`;
    if (candidate.length <= MAX_INSTRUCTION_NOTIFY_CHARS) {
      return candidate;
    }
    const budget = MAX_INSTRUCTION_NOTIFY_CHARS - 4;
    if (budget >= 2) {
      return `「${label.slice(0, budget)}」を探す`;
    }
  }
  return clamp(`${direction}スワイプ`);
}

/** Sample essentials used by smoke + call-site docs. */
export const MINIMAL_NOTIFY_SAMPLES = {
  goHome: 'ホームへ',
  longPress: '長押し',
  tapDelete: '「削除」をタップ',
  confirm: '「削除」をタップ',
  openMail: 'メールを開く',
  showNumber: '番号を出す',
  checkNumber: '番号を確認',
  scamRisk: '詐欺の恐れ',
  caution: '注意が必要',
  unknown: '判断できません',
  cameraPerm: 'カメラ許可？',
  micPerm: 'マイク許可？',
  screenCheck: '画面を確認',
  secret: '秘密あり',
  unreadable: '読み取れず',
  running: '案内中',
  paused: '一時停止中',
} as const;

export type MinimalNotifyOptions = {
  notifyText?: string;
  stageId?: string;
  stepId?: string;
};

/**
 * Resolve the text actually sent in an instruction notification.
 * Prefer explicit notifyText; else stage/step; else patterns from display; else short clause.
 */
export function resolveMinimalNotifyInstruction(
  displayText: string,
  options: MinimalNotifyOptions = {},
): string {
  const explicit = options.notifyText?.trim() ?? '';
  if (explicit) {
    return clamp(explicit);
  }
  const byStage = byStageOrStep(options.stageId ?? '', options.stepId ?? '');
  if (byStage) {
    return byStage;
  }
  const patterned = fromDisplayPatterns(displayText);
  if (patterned) {
    return patterned;
  }
  return essentialsFallback(displayText);
}

function byStageOrStep(stageId: string, stepId: string): string | null {
  switch (stageId) {
    case 'uninstall-go-home':
      return MINIMAL_NOTIFY_SAMPLES.goHome;
    case 'uninstall-long-press':
      return MINIMAL_NOTIFY_SAMPLES.longPress;
    case 'uninstall-menu':
      return MINIMAL_NOTIFY_SAMPLES.tapDelete;
    case 'uninstall-confirm':
      return MINIMAL_NOTIFY_SAMPLES.confirm; // 「削除」をタップ
    case 'safety-wait':
      return stepId.includes('email')
        ? MINIMAL_NOTIFY_SAMPLES.openMail
        : MINIMAL_NOTIFY_SAMPLES.showNumber;
    case 'unreadable':
      return MINIMAL_NOTIFY_SAMPLES.unreadable;
    case 'explain-sensitive':
      return MINIMAL_NOTIFY_SAMPLES.secret;
    case 'explain-screen':
      return MINIMAL_NOTIFY_SAMPLES.screenCheck;
    default:
      break;
  }
  if (stageId.startsWith('popup-permission_camera')) {
    return MINIMAL_NOTIFY_SAMPLES.cameraPerm;
  }
  if (stageId.startsWith('popup-permission_mic')) {
    return MINIMAL_NOTIFY_SAMPLES.micPerm;
  }
  if (stageId.startsWith('popup-permission_photos')) {
    return '写真許可？';
  }
  if (stageId.startsWith('popup-permission_notifications')) {
    return '通知許可？';
  }
  if (stageId.startsWith('popup-permission_location')) {
    return '位置許可？';
  }
  if (stageId.startsWith('popup-permission_contacts')) {
    return '連絡先許可？';
  }
  if (stageId.startsWith('popup-permission_files')) {
    return 'ファイル許可？';
  }
  if (stageId.startsWith('popup-permission')) {
    return '許可を選ぶ';
  }
  if (stageId.startsWith('popup-terms')) {
    return '規約を確認';
  }
  if (stageId.startsWith('popup-update')) {
    return '更新を確認';
  }
  if (stageId.startsWith('popup-install')) {
    return 'インストール？';
  }
  if (stageId.startsWith('popup-')) {
    return '確認画面';
  }
  if (stepId === 'ocr-unreadable') {
    return MINIMAL_NOTIFY_SAMPLES.unreadable;
  }
  return null;
}

function fromDisplayPatterns(displayText: string): string | null {
  const t = displayText.trim();
  if (!t) {
    return null;
  }
  if (t.includes('詐欺の可能性が高い')) {
    return MINIMAL_NOTIFY_SAMPLES.scamRisk;
  }
  if (t === '注意が必要です' || t.startsWith('注意が必要')) {
    return MINIMAL_NOTIFY_SAMPLES.caution;
  }
  // Phone finding lines include both 番号 and 判断できません — prefer 番号を確認.
  if (t.startsWith('番号「') || (t.includes('番号「') && t.includes('判断'))) {
    return MINIMAL_NOTIFY_SAMPLES.checkNumber;
  }
  if (t.includes('公開情報では判断できません')) {
    return MINIMAL_NOTIFY_SAMPLES.unknown;
  }
  if (t.includes('メールやメッセージを開いて')) {
    return MINIMAL_NOTIFY_SAMPLES.openMail;
  }
  if (t.includes('電話アプリで番号') || t.includes('番号を出して')) {
    return MINIMAL_NOTIFY_SAMPLES.showNumber;
  }
  if (t.includes('長押し')) {
    return MINIMAL_NOTIFY_SAMPLES.longPress;
  }
  if (
    t.includes('ホーム画面') ||
    t.startsWith('ホームへ') ||
    t.includes('ホームから')
  ) {
    return MINIMAL_NOTIFY_SAMPLES.goHome;
  }
  if (t.includes('秘密の文字')) {
    return MINIMAL_NOTIFY_SAMPLES.secret;
  }
  if (t.includes('読み取れません')) {
    return MINIMAL_NOTIFY_SAMPLES.unreadable;
  }

  // Prefer quoted tap/select targets → 「ラベル」をタップ
  const tap = /「([^」]{1,20})」(?:を|から)?(?:タップ|押|選)/.exec(t);
  if (tap) {
    return tapNotify(tap[1]);
  }
  const scrollLook = /スワイプして、「([^」]{1,16})」を探/.exec(t);
  if (scrollLook) {
    return scrollNotify(scrollLook[1]);
  }
  if (t.includes('スワイプ')) {
    return '下へスワイプ';
  }
  const ask = /「([^」]{1,12})」と「([^」]{1,12})」/.exec(t);
  if (ask && (t.includes('どちら') || t.includes('どっち'))) {
    const candidate = `「${ask[1]}」か「${ask[2]}」`;
    if (candidate.length <= MAX_INSTRUCTION_NOTIFY_CHARS) {
      return candidate;
    }
    return 'どちらをタップ';
  }

  if (t.includes('カメラ') && t.includes('聞いている')) {
    return MINIMAL_NOTIFY_SAMPLES.cameraPerm;
  }
  if (t.includes('マイク') && t.includes('聞いている')) {
    return MINIMAL_NOTIFY_SAMPLES.micPerm;
  }
  if (t.includes('写真') && t.includes('聞いている')) {
    return '写真許可？';
  }
  if (t.includes('通知') && t.includes('聞いている')) {
    return '通知許可？';
  }
  if (t.includes('位置情報') && t.includes('聞いている')) {
    return '位置許可？';
  }
  if (t.includes('連絡先') && t.includes('聞いている')) {
    return '連絡先許可？';
  }
  if (t.includes('ファイル') && t.includes('聞いている')) {
    return 'ファイル許可？';
  }
  if (t.includes('利用許可') || t.includes('許可を聞いている')) {
    return '許可を選ぶ';
  }
  if (t.includes('利用規約') || t.includes('同意')) {
    return '規約を確認';
  }
  if (t.includes('更新') && t.includes('確認')) {
    return '更新を確認';
  }
  if (t.includes('入れてよいか') || t.includes('インストール')) {
    return 'インストール？';
  }
  if (t.includes('確認する画面') || t.includes('確認画面')) {
    return '確認画面';
  }
  if (t.includes('画面には「')) {
    return MINIMAL_NOTIFY_SAMPLES.screenCheck;
  }
  return null;
}

function essentialsFallback(displayText: string): string {
  const trimmed = displayText.trim();
  if (!trimmed) {
    return '案内';
  }
  const firstClause =
    trimmed
      .split(/[。．！？\n]/)
      .map((s) => s.trim())
      .find((s) => s.length > 0) ?? trimmed;
  if (firstClause.length <= MAX_INSTRUCTION_NOTIFY_CHARS) {
    return firstClause;
  }
  const withoutPlease = firstClause
    .replace(/してください$/, '')
    .replace(/下さい$/, '')
    .replace(/ください$/, '')
    .trim();
  if (withoutPlease && withoutPlease.length <= MAX_INSTRUCTION_NOTIFY_CHARS) {
    return withoutPlease;
  }
  return '次の一手';
}

function clamp(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_INSTRUCTION_NOTIFY_CHARS) {
    return trimmed;
  }
  return truncateInstructionNotifyText(trimmed);
}
