import { maskSensitiveText } from './piiMask';

export type UiElementInfo = {
  label: string;
  role?: string;
  /** Normalized 0–1 center if known */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
};

export type ScreenContextInput = {
  goalSummary: string;
  ocrText: string;
  a11yText?: string;
  appName?: string;
  packageName?: string;
  dialogPresent?: boolean;
  dialogButtons?: string[];
  uiElements?: UiElementInfo[];
  lastGuidedAction?: string;
  userAnswer?: 'できた' | '分からない' | string;
  previousOcrText?: string;
};

export type ScreenContext = {
  goalSummary: string;
  ocrText: string;
  a11yText: string;
  appName: string;
  packageName: string;
  dialogPresent: boolean;
  dialogButtons: string[];
  uiElements: UiElementInfo[];
  lastGuidedAction: string;
  userAnswer: string;
  ocrDiffSummary: string;
  evidenceLabels: string[];
};

const KNOWN_LABELS = [
  '許可しない',
  '許可する',
  '送信',
  '送る',
  'アルバム',
  'ギャラリー',
  '写真',
  'カメラ',
  '設定',
  'Wi-Fi',
  'Wi‑Fi',
  '通知',
  '友だち',
  'トーク',
  'ホーム',
  'キャンセル',
  '同意する',
  '次へ',
  '閉じる',
  '選択',
  '添付',
  'インストール',
  '更新',
  '購入',
  '注文',
  'カート',
  '検索',
  'ブラウザ',
  'ダウンロード',
  '共有',
  '削除',
  '履歴',
  '着信',
  '発信',
  '電話',
  'メール',
  'Gmail',
  'Chrome',
  'Playストア',
  'ファイル',
  'ドキュメント',
];

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function extractLabels(text: string): string[] {
  const found: string[] = [];
  for (const label of KNOWN_LABELS) {
    if (text.includes(label) && !found.includes(label)) {
      found.push(label);
    }
  }
  return found.slice(0, 16);
}

function summarizeDiff(prev: string, next: string): string {
  const p = prev.replace(/\s+/g, ' ').trim();
  const n = next.replace(/\s+/g, ' ').trim();
  if (!p) return '初回画面';
  if (p === n) return '変化なし';
  if (!n) return '文字が消えた';
  // Cheap token diff: labels that appeared / disappeared
  const prevLabels = new Set(extractLabels(p));
  const nextLabels = extractLabels(n);
  const appeared = nextLabels.filter((l) => !prevLabels.has(l));
  const disappeared = [...prevLabels].filter((l) => !n.includes(l));
  const parts: string[] = [];
  if (appeared.length) parts.push(`出現:${appeared.slice(0, 4).join(',')}`);
  if (disappeared.length) parts.push(`消失:${disappeared.slice(0, 4).join(',')}`);
  if (!parts.length) parts.push('文言が変化');
  return parts.join(' / ');
}

/**
 * Build a masked, compact screen understanding object for the planner.
 * Only uses consented-session OCR / a11y text — never raw images.
 */
export function buildScreenContext(input: ScreenContextInput): ScreenContext {
  const ocrText = maskSensitiveText(input.ocrText.replace(/\s+/g, ' ').trim());
  const a11yText = maskSensitiveText(
    (input.a11yText ?? '').replace(/\s+/g, ' ').trim(),
  );
  const merged = [ocrText, a11yText].filter(Boolean).join(' ');
  const uiElements = (input.uiElements ?? [])
    .map((el) => ({
      ...el,
      label: maskSensitiveText(el.label).slice(0, 40),
    }))
    .slice(0, 24);
  const dialogButtons = (input.dialogButtons ?? [])
    .map((b) => maskSensitiveText(b).slice(0, 24))
    .slice(0, 8);
  const evidenceLabels = [
    ...extractLabels(merged),
    ...uiElements.map((e) => e.label),
    ...dialogButtons,
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  return {
    goalSummary: maskSensitiveText(input.goalSummary).slice(0, 120),
    ocrText: clip(ocrText, 600),
    a11yText: clip(a11yText, 400),
    appName: (input.appName ?? '').slice(0, 40),
    packageName: (input.packageName ?? '').slice(0, 80),
    dialogPresent: Boolean(input.dialogPresent),
    dialogButtons,
    uiElements,
    lastGuidedAction: maskSensitiveText(input.lastGuidedAction ?? '').slice(0, 80),
    userAnswer: (input.userAnswer ?? '').slice(0, 40),
    ocrDiffSummary: summarizeDiff(input.previousOcrText ?? '', ocrText),
    evidenceLabels: evidenceLabels.slice(0, 20),
  };
}

export function screenContextToPromptBlock(ctx: ScreenContext): string {
  const buttons = ctx.uiElements
    .map((e) => {
      const pos =
        e.x != null && e.y != null
          ? `@(${e.x.toFixed(2)},${e.y.toFixed(2)})`
          : '';
      return `${e.label}${pos}`;
    })
    .join(' | ');
  return [
    `目標: ${ctx.goalSummary}`,
    `アプリ: ${ctx.appName || '(不明)'} / ${ctx.packageName || '(不明)'}`,
    `ダイアログ: ${ctx.dialogPresent ? 'あり' : 'なし'} ボタン=[${ctx.dialogButtons.join(',')}]`,
    `OCR: ${ctx.ocrText || '(なし)'}`,
    `A11y: ${ctx.a11yText || '(なし)'}`,
    `UI要素: ${buttons || '(なし)'}`,
    `根拠ラベル: ${ctx.evidenceLabels.join(',') || '(なし)'}`,
    `前回との差: ${ctx.ocrDiffSummary}`,
    `直前の案内: ${ctx.lastGuidedAction || '(なし)'}`,
    `利用者の返答: ${ctx.userAnswer || '(なし)'}`,
  ].join('\n');
}
