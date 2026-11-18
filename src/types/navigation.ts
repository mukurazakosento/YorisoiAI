import type { ClarifyHistoryEntry } from './consultation';

export type FeatureId = 'operationSupport' | 'textExplanation' | 'safetyCheck';

export type RootStackParamList = {
  Home: undefined;
  Consultation: {
    featureId: FeatureId;
    /** 解決しなかったあとの再相談など */
    presetText?: string;
  };
  AiChoice: {
    featureId: FeatureId;
    text: string;
    choiceLabel?: string;
    clarifyRound: number;
    /** これまでの質問と答え（アキネーター履歴） */
    clarifyHistory?: ClarifyHistoryEntry[];
  };
  SupportSession: {
    featureId: FeatureId;
    summary: string;
  };
  EndSupport: {
    featureId: FeatureId;
    summary: string;
  };
  Settings: undefined;
  Privacy: undefined;
  About: undefined;
};
