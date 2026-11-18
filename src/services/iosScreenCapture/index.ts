/**
 * iOS 27 ScreenCaptureKit デモ境界（キャプチャ証明のみ）。
 *
 * Hard rules:
 * - システム共有ピッカー同意を飛ばさない
 * - フレーム画像をディスク保存・外部送信しない（件数と時刻のみ）
 * - OCR / AI / 通知 / 音声には繋げない
 * - Web 試作の画面共有経路とは分離。Broadcast Extension は使わない
 * - 未対応環境でライブ収録が動いているように見せない
 */

export type {
  IosScreenCaptureAvailability,
  IosScreenCapturePhase,
  IosScreenCaptureSessionState,
} from './types';

export { getIosScreenCaptureAvailability } from './availability';

export {
  getIosScreenCaptureSessionState,
  resetIosScreenCaptureSessionForTests,
  startIosScreenCaptureKit,
  stopIosScreenCaptureKit,
  subscribeIosScreenCaptureSession,
} from './session';
