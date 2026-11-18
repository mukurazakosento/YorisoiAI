import type { FeatureId } from './navigation';

export type ConsultationChoice = {
  id: string;
  label: string;
};

/** アキネーター式の1問分の履歴（支援セッション前に保持） */
export type ClarifyHistoryEntry = {
  question: string;
  answer: string;
};

export type ConsultationSession = {
  featureId: FeatureId;
  inputText: string;
  selectedChoiceIds: string[];
};
