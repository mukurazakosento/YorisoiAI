/**
 * アプリ削除（アンインストール）専用の高齢者向け案内。
 * 既存の汎用操作支援・インストール案内とは別経路。
 * 自動タップ・自動削除・自動確認はしない。
 *
 * 3 段階（通知 ≤17 / TTS は定型のまま）:
 * ① 消したいアプリを表示 → 約10秒で長押しへ
 * ② アイコンを長押し → 「削除」が見えたときだけ ③ へ。メニューなしは長押し再案内
 * ③ 削除項目を確認 → 利用者自身が押す（自動削除なし）
 */

export type UninstallGuidanceStep = {
  stepId: string;
  stageId: UninstallStageId;
  displayText: string;
  voiceText: string;
  /**
   * Heads-up body: short action-only ≤17.
   * TTS uses fuller voiceText — not this notify line.
   */
  notifyText: string;
};

export type UninstallStageId =
  | 'uninstall-go-home'
  | 'uninstall-long-press'
  | 'uninstall-menu'
  | 'uninstall-confirm';

const STAGE_RANK: Record<UninstallStageId, number> = {
  'uninstall-go-home': 0,
  'uninstall-long-press': 1,
  'uninstall-menu': 2,
  'uninstall-confirm': 2, // same step ③ copy as menu (confirm dialog also shows 削除)
};

/**
 * Stall timeout on uninstall-go-home: do not wait forever for perfect home OCR.
 * Ops cycle stays ~20s; FGS uses this as the next-poll delay while on go-home.
 */
export const UNINSTALL_GO_HOME_STALL_TIMEOUT_MS = 10_000;

/** ① Show target app — notify ≤17 */
export const UNINSTALL_SHOW_APP_NOTIFY = '消したいアプリを表示';
/** ① TTS (verbatim) */
export const UNINSTALL_SHOW_APP_VOICE =
  'ホーム画面かアプリ一覧を開いて、消したいアプリが見えるところまで進んでください。見つからないときは、画面を左右にスクロールして探してください。';

/** ② Long-press — notify ≤17 */
export const UNINSTALL_LONG_PRESS_NOTIFY = 'アイコンを長押し';
/** ② TTS (verbatim) */
export const UNINSTALL_LONG_PRESS_VOICE =
  '消したいアプリのアイコンを指で押したままにしてください。アプリの近くに小さなメニューが表示されるまで押し続けてください。メニューが出たら指を離してください。';

/** ③ Confirm delete item — notify ≤17 */
export const UNINSTALL_CONFIRM_DELETE_NOTIFY = '削除項目を確認';
/** ③ TTS (verbatim) */
export const UNINSTALL_CONFIRM_DELETE_VOICE =
  'メニューにある削除の項目を確認してください。これを選ぶと、アプリがスマホから取り除かれます。アプリによっては、中に保存していた写真やメモ、記録なども一緒に消える場合があります。残しておきたいものがないか確認してください。削除してよければ、ご自身で削除の項目を押してください。';

/**
 * Shared consequence / confirm TTS (step ③).
 * Kept export name for smoke / demo compatibility.
 */
export const UNINSTALL_CONSEQUENCE_VOICE = UNINSTALL_CONFIRM_DELETE_VOICE;

const HOME_CUES = [
  'google',
  'playストア',
  'playstore',
  '電話',
  'メッセージ',
  '設定',
  'カメラ',
  'クロック',
  '時計',
  '天気',
  'カレンダー',
  'chrome',
  '写真',
  'gmail',
  'youtube',
] as const;

/** Session-local stage cursor (prevents OCR flicker regress). */
let lastUninstallStageId: UninstallStageId | '' = '';

/** Wall-clock when uninstall-go-home was first selected this session. */
let goHomeEnteredAtMs: number | null = null;

/**
 * Clear uninstall stage cursor (call when a new assist session starts).
 */
export function resetUninstallGuidanceProgress(): void {
  lastUninstallStageId = '';
  goHomeEnteredAtMs = null;
}

/**
 * Next capture delay hint: while stuck on go-home, poll by the stall timeout (~10s)
 * so auto-advance can fire without waiting a full ~20s ops cycle.
 */
export function uninstallAssistPollDelayMs(
  stageId: string | null | undefined,
  defaultIntervalMs: number,
): number {
  if (normalizeUninstallStage(stageId) === 'uninstall-go-home') {
    return Math.min(defaultIntervalMs, UNINSTALL_GO_HOME_STALL_TIMEOUT_MS);
  }
  return defaultIntervalMs;
}

/**
 * 目標文が「アプリを消したい」系か。インストールとは別に判定する。
 */
export function looksLikeUninstallGoal(goalNormalized: string): boolean {
  const g = goalNormalized.replace(/\s+/g, '').toLowerCase();
  if (!g) {
    return false;
  }
  if (
    g.includes('アンインストール') ||
    g.includes('uninstall') ||
    g.includes('アプリを消し') ||
    g.includes('アプリを削除') ||
    g.includes('アプリ削除') ||
    g.includes('アプリを消したい') ||
    g.includes('消したいアプリ') ||
    g.includes('アプリを消す') ||
    g.includes('アプリ消し')
  ) {
    return true;
  }
  if (
    (g.includes('消し') || g.includes('削除')) &&
    (g.includes('アプリ') || g.includes('アイコン')) &&
    !g.includes('入れ') &&
    !g.includes('インストール')
  ) {
    return true;
  }
  return false;
}

/**
 * 相談開始などから渡す正規サマリー（検出・デモ脚本のキーになる）。
 */
export const UNINSTALL_GOAL_SUMMARY = 'アプリをアンインストールしたい';

/**
 * OCR に応じた削除専用の次の一手。一度に一つだけ。
 * previousStageId があれば後戻りを抑え、段階を進める。
 * nowMs はテスト用（省略時は Date.now()）。
 */
export function buildUninstallGuidanceStep(input: {
  ocrNormalized: string;
  ocrRaw: string;
  previousStageId?: string | null;
  nowMs?: number;
}): UninstallGuidanceStep {
  const o = input.ocrNormalized;
  const raw = input.ocrRaw;
  const now = input.nowMs ?? Date.now();
  const prev =
    normalizeUninstallStage(input.previousStageId) ??
    normalizeUninstallStage(lastUninstallStageId);

  const ocrStage = matchUninstallStageFromOcr(o);
  let stage = resolveUninstallStage(ocrStage, prev);
  stage = applyGoHomeStallTimeout(stage, now);
  const step = stepForUninstallStage(stage, raw, o);
  lastUninstallStageId = step.stageId;
  return step;
}

/**
 * Soft-advance / re-guide when the same uninstall step repeats (anti-loop).
 * go-home stall → advance to long-press.
 * long-press without 「削除」 → re-guide long-press (do not invent advance).
 * menu/confirm → re-speak step ③ (no auto-tap).
 */
export function buildUninstallAntiLoopStep(
  stuckStageId: string | null | undefined,
): UninstallGuidanceStep {
  const stage = normalizeUninstallStage(stuckStageId) ?? 'uninstall-long-press';
  if (stage === 'uninstall-go-home') {
    goHomeEnteredAtMs = null;
    lastUninstallStageId = 'uninstall-long-press';
    const longPress = uninstallLongPressStep();
    return {
      stepId: 'uninstall-anti-loop-home',
      stageId: 'uninstall-long-press',
      displayText: longPress.displayText,
      voiceText: longPress.voiceText,
      notifyText: longPress.notifyText,
    };
  }
  if (stage === 'uninstall-menu' || stage === 'uninstall-confirm') {
    const confirm = uninstallConfirmDeleteStep();
    return {
      stepId: 'uninstall-anti-loop-confirm',
      stageId: stage,
      displayText: confirm.displayText,
      voiceText: confirm.voiceText,
      notifyText: confirm.notifyText,
    };
  }
  // long-press (default): re-guide — do not advance without 「削除」
  const longPress = uninstallLongPressStep();
  return {
    stepId: 'uninstall-anti-loop-long-press',
    stageId: 'uninstall-long-press',
    displayText: longPress.displayText,
    voiceText: longPress.voiceText,
    notifyText: longPress.notifyText,
  };
}

function normalizeUninstallStage(
  value: string | null | undefined,
): UninstallStageId | null {
  if (!value) return null;
  if (
    value === 'uninstall-go-home' ||
    value === 'uninstall-find' ||
    value === 'uninstall-find-app'
  ) {
    return 'uninstall-go-home';
  }
  if (
    value === 'uninstall-long-press' ||
    value === 'uninstall-menu' ||
    value === 'uninstall-confirm'
  ) {
    return value;
  }
  return null;
}

function matchUninstallStageFromOcr(o: string): UninstallStageId {
  // Step ③ only when 「削除」(or アンインストール) is visible — no menu → stay earlier.
  if (looksLikeDeleteLabelVisible(o)) {
    return looksLikeUninstallConfirmDialog(o)
      ? 'uninstall-confirm'
      : 'uninstall-menu';
  }
  if (looksLikeHomeOrAppList(o)) {
    return 'uninstall-long-press';
  }
  return 'uninstall-go-home';
}

/**
 * Prefer clear OCR jumps forward; avoid regressing on flicker.
 * Long-press does not advance unless 「削除」 is visible.
 */
function resolveUninstallStage(
  ocrStage: UninstallStageId,
  previous: UninstallStageId | null,
): UninstallStageId {
  if (!previous) {
    return ocrStage;
  }
  const prevRank = STAGE_RANK[previous];

  // Clear delete-label OCR always wins (menu / confirm dialog).
  if (ocrStage === 'uninstall-confirm' || ocrStage === 'uninstall-menu') {
    return ocrStage;
  }
  // Home icons → long-press; do not drop back from menu/confirm on flicker.
  if (ocrStage === 'uninstall-long-press') {
    if (prevRank >= STAGE_RANK['uninstall-menu']) {
      return previous;
    }
    return 'uninstall-long-press';
  }
  // Ambiguous / not-home / no 削除: keep progress (re-guide long-press if already there).
  if (prevRank > STAGE_RANK['uninstall-go-home']) {
    return previous;
  }
  return 'uninstall-go-home';
}

/**
 * If still on go-home after ~10s with no OCR advance, continue to long-press.
 * Does not auto-tap; only advances spoken/notify guidance.
 */
function applyGoHomeStallTimeout(
  stage: UninstallStageId,
  nowMs: number,
): UninstallStageId {
  if (stage !== 'uninstall-go-home') {
    goHomeEnteredAtMs = null;
    return stage;
  }
  if (goHomeEnteredAtMs == null) {
    goHomeEnteredAtMs = nowMs;
    return 'uninstall-go-home';
  }
  if (nowMs - goHomeEnteredAtMs >= UNINSTALL_GO_HOME_STALL_TIMEOUT_MS) {
    goHomeEnteredAtMs = null;
    return 'uninstall-long-press';
  }
  return 'uninstall-go-home';
}

function stepForUninstallStage(
  stage: UninstallStageId,
  raw: string,
  o: string,
): UninstallGuidanceStep {
  void raw;
  void o;
  switch (stage) {
    case 'uninstall-confirm':
    case 'uninstall-menu':
      return uninstallConfirmDeleteStep(stage);
    case 'uninstall-long-press':
      return uninstallLongPressStep();
    case 'uninstall-go-home':
    default:
      return uninstallShowAppStep();
  }
}

/** 「削除」または「アンインストール」が画面に見えるときだけ step ③ へ進む。 */
function looksLikeDeleteLabelVisible(o: string): boolean {
  return o.includes('削除') || o.includes('アンインストール');
}

function looksLikeUninstallConfirmDialog(o: string): boolean {
  const ask =
    o.includes('しますか') ||
    o.includes('よろしい') ||
    o.includes('ほんとうに') ||
    o.includes('本当に') ||
    o.includes('取り消せ') ||
    o.includes('削除します') ||
    o.includes('アンインストールします');
  return ask && looksLikeDeleteLabelVisible(o);
}

function looksLikeHomeOrAppList(o: string): boolean {
  let hits = 0;
  for (const cue of HOME_CUES) {
    if (o.includes(cue)) {
      hits += 1;
    }
  }
  return hits >= 2;
}

function uninstallShowAppStep(): UninstallGuidanceStep {
  return {
    stepId: 'uninstall-go-home',
    stageId: 'uninstall-go-home',
    displayText: '消したいアプリが見えるところまで進んでください。',
    voiceText: UNINSTALL_SHOW_APP_VOICE,
    notifyText: UNINSTALL_SHOW_APP_NOTIFY,
  };
}

function uninstallLongPressStep(): UninstallGuidanceStep {
  return {
    stepId: 'uninstall-long-press',
    stageId: 'uninstall-long-press',
    displayText: '消したいアプリのアイコンを長押ししてください。',
    voiceText: UNINSTALL_LONG_PRESS_VOICE,
    notifyText: UNINSTALL_LONG_PRESS_NOTIFY,
  };
}

function uninstallConfirmDeleteStep(
  stageId: 'uninstall-menu' | 'uninstall-confirm' = 'uninstall-menu',
): UninstallGuidanceStep {
  return {
    stepId:
      stageId === 'uninstall-confirm'
        ? 'uninstall-confirm-consequence'
        : 'uninstall-tap-delete',
    stageId,
    displayText: 'メニューの削除の項目を確認してから、ご自身で押してください。',
    voiceText: UNINSTALL_CONFIRM_DELETE_VOICE,
    notifyText: UNINSTALL_CONFIRM_DELETE_NOTIFY,
  };
}
