/**
 * ネイティブ／Node 向けスタブ。実 OCR は tesseractOcr.web.ts。
 * 画像をサーバーへ送る経路は置かない。
 */
export type RecognizeCanvasResult = {
  text: string;
  empty: boolean;
};

export async function recognizeJapaneseFromCanvas(
  _canvas: unknown,
): Promise<RecognizeCanvasResult> {
  return {
    text: '',
    empty: true,
  };
}

export async function terminateOcrWorker(): Promise<void> {
  // no-op outside web
}
