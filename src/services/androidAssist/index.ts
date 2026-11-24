/**
 * Android MediaProjection 背面支援（端末内 OCR → 案内 → 通知/TTS）。
 *
 * Hard rules:
 * - Android EAS ビルドのみ。iOS / Web / Expo Go では不可を明示
 * - 画像は端末内のみ・非保存。外部送信しない
 * - 勝手にタップ／送信しない
 * - ネイティブ Llama 未接続時は mode: demo（live と偽らない）
 */
export type {
  AndroidAssistAvailability,
  AndroidAssistAvailabilityReason,
  AndroidAssistGuidance,
  AndroidAssistSessionPhase,
  AndroidAssistSessionState,
  StartAndroidAssistInput,
} from './types';

export { getAndroidAssistAvailability } from './availability';

export {
  buildGuidanceFromOcrText,
  hasClearSentConfirmation,
  looksLikeLinePhotoGoal,
  shouldAnnounceGuidanceStep,
  unreadableGuidanceStep,
} from './guidanceFromOcr';

export {
  isVagueGuidanceText,
  rejectOrRewriteVagueGuidance,
  buildConcreteOpsStep,
  formatScrollInstruction,
  formatTapInstruction,
} from './concreteGuidance';

export {
  ASSIST_INTERVAL_MAX_MS,
  ASSIST_INTERVAL_MIN_MS,
  OPS_ASSIST_INTERVAL_MS,
  SAFETY_ASSIST_INTERVAL_MS,
  TEXT_EXPLAIN_ASSIST_INTERVAL_MS,
  assistIntervalForFeature,
  clampAssistIntervalMs,
} from './intervals';

export {
  containsSensitive,
  detectPopup,
  explainPopup,
  explainScreenText,
  isPopupStable,
  redactSecretsForPublicText,
  redactSecretsForVoice,
  requiredPopupStreak,
} from './popupDetect';
export type { PopupDetection, PopupExplainStep, PopupKind } from './popupDetect';

export { pickBestDialogText, resolveAssistGuidance } from './resolveGuidance';
export type { ResolveGuidanceInput, ResolveGuidanceResult } from './resolveGuidance';

export {
  applyOcrTextForTests,
  getAndroidAssistSessionState,
  pauseAndroidAssistSession,
  resetAndroidAssistSessionForTests,
  resumeAndroidAssistSession,
  startAndroidAssistSession,
  stopAndroidAssistSession,
  subscribeAndroidAssistSession,
} from './session';

// dialogAccessibility is imported directly by screens (lazy native require).
// Not re-exported here so Node smokes avoid pulling react-native.
