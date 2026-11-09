/**
 * 端末内 OCR の公開型。
 * 画像バイナリはここに含まれない（URI も AI へ渡さない）。
 */

/** 画面内の相対位置（0〜1）。左上原点。 */
export type RelativeBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/** ピクセル座標の矩形（画像左上原点）。 */
export type PixelBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrElement = {
  text: string;
  bounds?: RelativeBounds;
  pixelBounds?: PixelBounds;
};

export type OcrLine = {
  text: string;
  bounds?: RelativeBounds;
  pixelBounds?: PixelBounds;
  elements: OcrElement[];
};

export type OcrBlock = {
  text: string;
  bounds?: RelativeBounds;
  pixelBounds?: PixelBounds;
  lines: OcrLine[];
};

export type OcrResult = {
  /** 認識した全文 */
  fullText: string;
  /** ブロック（段落相当） */
  blocks: OcrBlock[];
  /** 行単位の一覧（UI / 位置ヒント用） */
  lines: OcrLine[];
  /** 画像サイズ（相対位置の算出元）。不明時は省略 */
  imageSize?: { width: number; height: number };
  /** 使用エンジン。リモート OCR は使わない */
  engine: 'mlkit-japanese' | 'unavailable';
};

export type OcrAvailability = {
  available: boolean;
  /** 利用者向けの短い説明 */
  message: string;
  /** Expo Go / Web / シミュレータ等で使えない理由 */
  reason?:
    | 'web'
    | 'expo-go-or-missing-native'
    | 'android-stub'
    | 'simulator'
    | 'ok';
};

export type PickedScreenshot = {
  /** 端末内の一時ファイル URI（外部送信禁止） */
  uri: string;
  width?: number;
  height?: number;
};
