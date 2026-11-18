/**
 * Web 試作: getDisplayMedia + キャンバスフレーム + Tesseract.js（ブラウザ内）。
 * ネイティブ capture / ML Kit とは分離。画像は外部送信しない・保持しない。
 */

export type WebCaptureSupport =
  | 'available'
  | 'unsupported'
  | 'secure-context-required';

export type WebSharePhase =
  | 'idle'
  | 'requesting'
  | 'sharing'
  | 'paused'
  | 'ocr'
  | 'ended'
  | 'hidden'
  | 'error'
  | 'unavailable';

export type WebCaptureAvailability = {
  supported: boolean;
  support: WebCaptureSupport;
  /** 画面共有ボタンを出せるか */
  canStartShare: boolean;
  recordingLabel: string;
  ocrLabel: string;
  message: string;
};

export type WebOcrSnapshot = {
  text: string;
  recognizedAt: number;
  /** 文字が空だったか */
  empty: boolean;
};

export type WebCaptureSessionState = {
  phase: WebSharePhase;
  availability: WebCaptureAvailability;
  statusMessage: string;
  /** 共有中か（トラック生存） */
  sharing: boolean;
  /** フレーム取り込み一時停止 */
  paused: boolean;
  /** タブが隠れて処理を止めた */
  tabHidden: boolean;
  lastOcr: WebOcrSnapshot | null;
  frameCount: number;
  errorDetail: string | null;
};
