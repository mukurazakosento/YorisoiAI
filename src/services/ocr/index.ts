/**
 * 端末内 OCR の境界（Google ML Kit）。
 * 画像バイナリは外部へ送らない。第4段階で実装する。
 */
export type OcrBlock = {
  text: string;
  /** 画面内の相対位置（0〜1）。未取得時は省略可 */
  bounds?: { left: number; top: number; right: number; bottom: number };
};

export type OcrResult = {
  fullText: string;
  blocks: OcrBlock[];
};

export async function recognizeTextFromImageUri(
  _imageUri: string,
): Promise<OcrResult> {
  throw new Error(
    '文字認識（OCR）は第4段階で実装します。画像は端末の外へ送りません。',
  );
}
