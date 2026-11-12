import type { FeatureId } from './navigation';

/**
 * 最終仕様の支援フロー状態機械。
 * Phase B: 案内・通知・音声を実装。画面収録／定期OCRは準備中のまま。
 */
export type SupportFlowPhase =
  | 'home'
  | 'consultation'
  | 'ai_choice'
  | 'support_session'
  | 'end_support';

/** 支援セッション画面内の段階 */
export type SupportSessionPhase = 'starting' | 'guiding' | 'offer_end';

export type IntentClarity = 'clear' | 'unclear';

export type SupportRequestDraft = {
  featureId: FeatureId;
  text: string;
  choiceLabel?: string;
  /** 意図確認の周回数（不明→選択肢の繰り返し） */
  clarifyRound: number;
};

export type SessionStepTone = 'normal' | 'simplify';

export type SessionInstructionStep = {
  displayText: string;
  voiceText: string;
  simplifyDisplayText: string;
  simplifyVoiceText: string;
};

export type SessionScript = {
  id: string;
  title: string;
  /** デモ明示用（端末内 AI 未接続時は必ず true） */
  isDemo: boolean;
  steps: SessionInstructionStep[];
};

export type CaptureStubStatus = '準備中';

export type SupportSessionCaptureStatus = {
  recording: CaptureStubStatus;
  periodicOcr: CaptureStubStatus;
};

/** 通知ペイロードの種別 */
export type SessionNotificationKind = 'instruction' | 'end_support';
