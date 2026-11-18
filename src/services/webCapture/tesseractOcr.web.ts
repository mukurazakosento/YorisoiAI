/**
 * ブラウザ内 Tesseract.js 日本語 OCR（無料 OSS）。
 * キャンバス画素のみをローカル認識。画像・映像をサーバーへ送らない。
 * 言語データ／worker は公式 CDN から取得（APIキー不要）。画像アップロードではない。
 */
import { createWorker, type Worker } from 'tesseract.js';

import type { RecognizeCanvasResult } from './tesseractOcr';

let worker: Worker | null = null;
let loading: Promise<Worker> | null = null;
/** stop／dispose でインクリメントし、進行中の createWorker を無効化 */
let generation = 0;

function toFriendlyOcrError(error: unknown): Error {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  if (/取り消|cancel|abort/i.test(raw)) {
    return new Error('OCRの準備が取り消されました。もう一度お試しください。');
  }
  if (/network|fetch|Failed to fetch|CDN|load/i.test(raw)) {
    return new Error(
      '文字認識の準備に失敗しました。通信を確認してから、もう一度画面共有を開始してください。',
    );
  }
  return new Error(
    '文字認識を開始できませんでした。しばらくしてからもう一度お試しください。',
  );
}

async function getWorker(): Promise<Worker> {
  if (worker) {
    return worker;
  }
  if (loading) {
    return loading;
  }

  const gen = generation;
  const settle = (async () => {
    try {
      // jpn 言語データは Tesseract 公式 CDN（OSS）。画像は送らない。
      const next = await createWorker('jpn');
      if (gen !== generation) {
        try {
          await next.terminate();
        } catch {
          // no-op
        }
        throw new Error('OCRの準備が取り消されました。もう一度お試しください。');
      }
      worker = next;
      return next;
    } catch (error) {
      // 失敗時は loading をクリアしてリトライ可能にする（重複 worker は作らない）
      throw toFriendlyOcrError(error);
    } finally {
      // このリクエストの loading だけ解除（別 generation の再試行を妨げない）
      loading = null;
    }
  })();

  loading = settle;
  return settle;
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

/**
 * worker を破棄。共有停止やセッション終了、初期化中のキャンセルで呼ぶ。
 * 以降の createWorker 完了は無効化され、再試行できる。
 */
export async function terminateOcrWorker(): Promise<void> {
  generation += 1;
  loading = null;
  const current = worker;
  worker = null;
  if (current) {
    try {
      await current.terminate();
    } catch {
      // no-op
    }
  }
}

export type { RecognizeCanvasResult };
