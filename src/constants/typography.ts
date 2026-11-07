/**
 * 本文はおおむね 20pt 以上。文字サイズ設定で倍率をかける。
 */
export const baseFontSizes = {
  body: 20,
  bodyLarge: 22,
  title: 26,
  header: 24,
  button: 22,
  caption: 18,
  input: 20,
} as const;

export type FontScaleKey = 'standard' | 'large' | 'extraLarge';

export const fontScaleFactors: Record<FontScaleKey, number> = {
  standard: 1,
  large: 1.15,
  extraLarge: 1.3,
};

export const fontScaleLabels: Record<FontScaleKey, string> = {
  standard: '標準',
  large: '大きい',
  extraLarge: 'とても大きい',
};

export function scaledSize(size: number, scale: FontScaleKey): number {
  return Math.round(size * fontScaleFactors[scale]);
}
