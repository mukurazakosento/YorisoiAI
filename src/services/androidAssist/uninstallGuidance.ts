/**
 * アプリ削除（アンインストール）専用の高齢者向け案内。
 * 既存の汎用操作支援・インストール案内とは別経路。
 * 自動タップ・自動削除・自動確認はしない。
 *
 * 方針:
 * - 長押しの秒数カウントを促すメタ助言は禁止（メニューが出るまで、と伝える）
 * - 最初にホーム画面から消したいアプリのある画面へ行くよう案内する
 * - 削除の結果（取り除ける／データが消える場合がある）を先に伝える
 * - OCR 段階の後戻りを抑え、同じ段階の繰り返しは anti-loop で解除する
 * - 「消したいアプリのある画面」段階で OCR が進まないときは約10秒で長押し案内へ進む
 */

import { tapNotify } from '../notifications/minimalNotifyInstruction';

export type UninstallGuidanceStep = {
  stepId: string;
  stageId: UninstallStageId;
  displayText: string;
  voiceText: string;
  /**
   * Heads-up body: short action-only ≤17 (e.g. 「削除」をタップ / 長押し).
   * TTS uses fuller voiceText (pre-#35/#36 baseline 88d07c7) — not this notify line.
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
  'uninstall-confirm': 3,
};

/**
 * Stall timeout on uninstall-go-home: do not wait forever for perfect home OCR.
 * Ops cycle stays ~20s; FGS uses this as the next-poll delay while on go-home.
 */
export const UNINSTALL_GO_HOME_STALL_TIMEOUT_MS = 10_000;

/** 削除の結果説明（意味を揃える定型）。 */
export const UNINSTALL_CONSEQUENCE_VOICE =
  'メニューから削除を選ぶと、アプリをスマートフォンから取り除けます。アプリによっては、中に保存していた写真やメモなどが一緒に消えてしまう場合があります。消す前に、そのアプリの中に残しておきたいものがないか確認しましょう。';

const DELETE_LABELS = [
  'アンインストール',
  '削除',
  'アンインストールしますか',
  '削除しますか',
  'アプリを削除',
  'このアプリを削除',
  'OK',
  'はい',
] as const;

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
  // 「消したい」単体でも操作支援の削除導線として扱う（入れたいは除外）
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
 * Soft-advance copy when the same uninstall step repeats (anti-loop).
 * go-home stall → advance to long-press (do not repeat home forever).
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
  if (stage === 'uninstall-menu') {
    return {
      stepId: 'uninstall-anti-loop-menu',
      stageId: 'uninstall-menu',
      displayText:
        'メニューの「削除」を選ぶ前に、残しておきたいものがないか確認しましょう。',
      voiceText: `${UNINSTALL_CONSEQUENCE_VOICE} やめたければ「キャンセル」です。代わりには押しません。`,
      notifyText: '「削除」をタップ',
    };
  }
  if (stage === 'uninstall-confirm') {
    return {
      stepId: 'uninstall-anti-loop-confirm',
      stageId: 'uninstall-confirm',
      displayText:
        '消す前に、残しておきたいものがないか確認しましょう。やめるなら「キャンセル」です。',
      voiceText: `${UNINSTALL_CONSEQUENCE_VOICE} やめたければ「キャンセル」や「いいえ」を押してください。よりそいAIは代わりに押しません。`,
      notifyText: '「削除」をタップ',
    };
  }
  // long-press (default): nudge toward looking for the menu without second-counting
  return {
    stepId: 'uninstall-anti-loop-long-press',
    stageId: 'uninstall-long-press',
    displayText:
      'メニューが出たら「削除」や「アンインストール」を探してください。',
    voiceText:
      '同じ案内が続いています。長押しでメニューや小さな窓が出たら指を離し、「削除」や「アンインストール」を探してください。見えなければ、一度指を離してもう一度長押ししてみてください。代わりには消しません。',
    notifyText: '長押し',
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
    // legacy find stage was the early "get to the app icon" step
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
  if (looksLikeUninstallConfirmDialog(o)) {
    return 'uninstall-confirm';
  }
  if (looksLikeUninstallMenu(o)) {
    return 'uninstall-menu';
  }
  if (looksLikeHomeOrAppList(o)) {
    return 'uninstall-long-press';
  }
  return 'uninstall-go-home';
}

/**
 * Prefer clear OCR jumps forward; avoid regressing on flicker.
 */
function resolveUninstallStage(
  ocrStage: UninstallStageId,
  previous: UninstallStageId | null,
): UninstallStageId {
  if (!previous) {
    return ocrStage;
  }
  const prevRank = STAGE_RANK[previous];

  // Clear later-stage OCR always wins (menu / confirm).
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
  // Ambiguous / not-home: keep progress instead of bouncing to go-home.
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
  switch (stage) {
    case 'uninstall-confirm':
      return uninstallConfirmConsequenceStep(raw, o);
    case 'uninstall-menu':
      return uninstallTapDeleteStep(raw, o);
    case 'uninstall-long-press':
      return uninstallLongPressStep();
    case 'uninstall-go-home':
    default:
      return uninstallGoHomeStep();
  }
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
  const del =
    o.includes('削除') ||
    o.includes('アンインストール') ||
    o.includes('消します');
  return ask && del;
}

function looksLikeUninstallMenu(o: string): boolean {
  return (
    o.includes('アンインストール') ||
    o.includes('アプリ情報') ||
    (o.includes('削除') &&
      (o.includes('アプリ') ||
        o.includes('メニュー') ||
        o.includes('編集') ||
        o.includes('ウィジェット') ||
        o.includes('無効')))
  );
}

function looksLikeHomeOrAppList(o: string): boolean {
  // Require real launcher cues — do NOT use bare length>N (that stalled progression).
  let hits = 0;
  for (const cue of HOME_CUES) {
    if (o.includes(cue)) {
      hits += 1;
    }
  }
  return hits >= 2;
}

function uninstallGoHomeStep(): UninstallGuidanceStep {
  return {
    stepId: 'uninstall-go-home',
    stageId: 'uninstall-go-home',
    displayText:
      'ホーム画面から、消したいアプリのある画面まで行ってください。',
    voiceText:
      'ホーム画面から、消したいアプリのある画面まで行ってください。アプリの絵文字マークが見えるところです。よりそいAIは代わりに消しません。',
    notifyText: 'ホームへ',
  };
}

function uninstallLongPressStep(): UninstallGuidanceStep {
  return {
    stepId: 'uninstall-long-press',
    stageId: 'uninstall-long-press',
    displayText: '消したいアプリを長押しして、メニューが出るまで待ってください。',
    voiceText:
      '消したいアプリのアイコンを指で長押ししてください。メニューや小さな窓が出るまで、そのまま押したままにしてください。メニューが出たら指を離してください。',
    notifyText: '長押し',
  };
}

function uninstallTapDeleteStep(raw: string, o: string): UninstallGuidanceStep {
  const label = pickDeleteLabel(raw, o);
  const quoted = label ? `「${label}」` : '「削除」や「アンインストール」';
  return {
    stepId: 'uninstall-tap-delete',
    stageId: 'uninstall-menu',
    displayText: `メニューから${quoted}を選ぶと、アプリをスマートフォンから取り除けます。`,
    voiceText: `${UNINSTALL_CONSEQUENCE_VOICE} 押すと確認の画面が出ることが多いです。まだ消えていません。代わりには押しません。`,
    notifyText: label ? tapNotify(label) : '「削除」をタップ',
  };
}

function uninstallConfirmConsequenceStep(
  raw: string,
  o: string,
): UninstallGuidanceStep {
  void raw;
  void o;
  return {
    stepId: 'uninstall-confirm-consequence',
    stageId: 'uninstall-confirm',
    displayText:
      '消す前に、残しておきたいものがないか確認しましょう。やめるなら「キャンセル」です。',
    voiceText: `${UNINSTALL_CONSEQUENCE_VOICE} やめたければ「キャンセル」や「いいえ」を押してください。よりそいAIは代わりに押しません。`,
    notifyText: '「削除」をタップ',
  };
}

function pickDeleteLabel(raw: string, o: string): string | null {
  for (const label of DELETE_LABELS) {
    if (raw.includes(label) || o.includes(label.replace(/\s+/g, ''))) {
      // Prefer the shorter actionable labels for display
      if (label === 'アンインストールしますか' || label === '削除しますか') {
        continue;
      }
      if (label === 'OK' || label === 'はい') {
        continue;
      }
      return label;
    }
  }
  if (o.includes('アンインストール')) {
    return 'アンインストール';
  }
  if (o.includes('削除')) {
    return '削除';
  }
  return null;
}
