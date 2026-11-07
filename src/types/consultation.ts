import type { FeatureId } from './navigation';

export type ConsultationChoice = {
  id: string;
  label: string;
};

export type ConsultationSession = {
  featureId: FeatureId;
  inputText: string;
  selectedChoiceIds: string[];
};
