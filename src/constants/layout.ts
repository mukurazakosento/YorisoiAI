/** タップ領域・余白の基準値（高齢者向け・ノンスクロール前提） */
export const layout = {
  minButtonHeight: 52,
  featureButtonMinHeight: 88,
  screenPadding: 20,
  sectionGap: 12,
  headerHeight: 56,
  borderRadius: 12,
  /** 相談画面で入力＋4選択肢が同時に収まるよう低めに */
  inputMinHeight: 72,
  choiceMinHeight: 48,
} as const;
