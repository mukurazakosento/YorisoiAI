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
