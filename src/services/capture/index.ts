/**
 * 画面収録・フレーム OCR 境界（最終仕様 Phase D）。
 *
 * Hard rules:
 * - 画像・映像は外部へ送らない（端末内 OCR のみ）
 * - 確認済みテキストだけが案内に渡る
 * - サイレントな他アプリ監視・偽ポップアップ検知をしない
 * - Expo Go / Web でライブ収録が動いているように見せない
 */
export type {
  CaptureAvailability,
  CaptureCapability,
  CaptureOsLimits,
  CaptureSessionPhase,
  ConfirmedFrameText,
  FeatureCapturePath,
  FrameOcrDraft,
} from './types';

export {
  CAPTURE_LIMITS_SHORT,
  CAPTURE_OS_LIMITS,
  formatCaptureLimitsForReadme,
} from './limits';

export {
  assertCaptureHonesty,
  getCaptureAvailability,
} from './availability';

export {
  BROADCAST_EXTENSION_PLAN,
  isBroadcastUploadLinked,
} from './broadcast';

export {
  allowsManualTextWithoutCapture,
  getFeatureCapturePath,
  shouldPreferOpenAppBeforeOcr,
} from './featurePaths';

export {
  clearFrameDraft,
  confirmFrameText,
  getCaptureSessionState,
  getConfirmedFrameText,
  requestUserFrame,
  resetCaptureSessionForTests,
  startCaptureSession,
  stopCaptureSession,
  subscribeCaptureSession,
  updateFrameDraft,
  type CaptureSessionState,
} from './session';

export {
  buildSummaryWithConfirmedFrame,
  rebuildGuidanceFromConfirmedFrame,
} from './guidanceFromFrame';
