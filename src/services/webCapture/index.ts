/**
 * Web 試作の画面共有＋Tesseract OCR（ネイティブ capture とは分離）。
 *
 * Hard rules:
 * - 利用者開始の getDisplayMedia のみ
 * - フレーム画像を保持・外部送信しない
 * - タブ非表示／共有終了を検知し、背面で動いているように見せない
 * - 未対応ブラウザは不可と明示
 */

export type {
  WebCaptureAvailability,
  WebCaptureSupport,
  WebCaptureSessionState,
  WebOcrSnapshot,
  WebSharePhase,
} from './types';

export {
  getWebCaptureAvailability,
  probeWebCaptureSupport,
} from './availability';

export {
  WEB_FRAME_INTERVAL_MS,
  getWebCaptureSessionState,
  pauseWebDisplayShare,
  resetWebCaptureSession,
  resetWebCaptureSessionForTests,
  resumeWebDisplayShare,
  startWebDisplayShare,
  stopWebDisplayShare,
  subscribeWebCaptureSession,
} from './session';
