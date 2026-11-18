/**
 * ブラウザ内 Tesseract.js 日本語 OCR（無料 OSS）。
 * キャンバス画素のみをローカル認識。画像・映像を外部へ送らない。
 */
import { createWorker, type Worker } from 'tesseract.js';

import type { RecognizeCanvasResult } from './tesseractOcr';

let worker: Worker | null = null;
let loading: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (worker) {
    return worker;
  }
  if (loading) {
    return loading;
  }
  loading = (async () => {
    // jpn 言語データは Tesseract 公式 CDN（OSS）から取得。APIキー不要。
    const next = await createWorker('jpn');
    worker = next;
    loading = null;
    return next;
  })();
  return loading;
}

export async function recognizeJapaneseFromCanvas(
  canvas: unknown,
): Promise<RecognizeCanvasResult> {
  if (
    typeof HTMLCanvasElement === 'undefined' ||
    !(canvas instanceof HTMLCanvasElement)
  ) {
    return { text: '', empty: true };
  }

  const active = await getWorker();
  const result = await active.recognize(canvas);
  const text = (result.data.text ?? '').replace(/\s+/g, ' ').trim();
  return {
    text,
    empty: text.length === 0,
  };
}

export async function terminateOcrWorker(): Promise<void> {
  const current = worker;
  worker = null;
  loading = null;
  if (current) {
    try {
      await current.terminate();
    } catch {
      // no-op
    }
  }
}

export type { RecognizeCanvasResult };
