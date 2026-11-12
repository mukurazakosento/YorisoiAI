import type { FeatureId } from '../../types/navigation';

/**
 * 画面収録・フレーム取り込みの能力。
 * - manual_screenshot_ocr: 利用者がスクショ → ライブラリ選択 → 端末内 OCR（いまの本線）
 * - broadcast_upload: ReplayKit Broadcast Upload Extension（未リンク時は使えない）
 * - unavailable: Web / Expo Go など。動いているように見せない
 */
export type CaptureCapability =
  | 'manual_screenshot_ocr'
  | 'broadcast_upload'
  | 'unavailable';

/** 支援セッション内の収録／読み取り段階 */
export type CaptureSessionPhase =
  | 'idle'
  | 'active'
  | 'picking'
  | 'review'
  | 'stopped'
  | 'unavailable';

export type CaptureAvailability = {
  /** 利用者開始のフレーム取り込み（スクショ選択＋OCR）が可能か */
  manualFrameAvailable: boolean;
  /** Broadcast Upload Extension がリンク済みか（現状は常に false） */
  broadcastUploadLinked: boolean;
  /** 定期の自動フレーム取り込みが可能か（未リンクなら false） */
  periodicAutoFramesAvailable: boolean;
  /** いま使える能力の代表値 */
  capability: CaptureCapability;
  /** 短いステータス文言（UI 1行） */
  recordingLabel: string;
  /** 定期 OCR の短いステータス文言 */
  periodicOcrLabel: string;
  /** 利用者向けの短い説明 */
  message: string;
  reason:
    | 'ok-manual'
    | 'web'
    | 'expo-go-or-missing-ocr'
    | 'android-limited'
    | 'broadcast-not-linked';
};

export type CaptureOsLimits = {
  can: string[];
  cannot: string[];
};

export type FeatureCapturePath = {
  featureId: FeatureId;
  /** 支援中の短いヒント（1行） */
  hint: string;
  /** 読み取りボタンのラベル */
  readButtonLabel: string;
  /** 確認後に案内へ渡すときの接頭辞 */
  confirmedPrefix: string;
};

export type FrameOcrDraft = {
  text: string;
};

export type ConfirmedFrameText = {
  text: string;
  /** 画像は含めない。確認済み文字のみ */
  confirmedAt: number;
  featureId: FeatureId;
};
