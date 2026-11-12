import type { FeatureId } from './navigation';

/**
 * 最終仕様の支援フロー状態機械（Phase A は UI シェル＋スタブ）。
 * 実録画・端末内 Llama・通知配線は後続フェーズ。
 */
export type SupportFlowPhase =
  | 'home'
  | 'consultation'
  | 'ai_choice'
  | 'support_session'
  | 'end_support';

export type IntentClarity = 'clear' | 'unclear';

export type SupportRequestDraft = {
  featureId: FeatureId;
  text: string;
  choiceLabel?: string;
  /** 意図確認の周回数（不明→選択肢の繰り返し） */
  clarifyRound: number;
};

export type SupportSessionStubStatus = {
  recording: '準備中';
  periodicOcr: '準備中';
  notifyAndSpeech: '準備中';
};
