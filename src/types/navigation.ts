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
  /** Android 背面支援の説明・同意（iOS/Web では経由しない） */
  AndroidAssistConsent: {
    featureId: FeatureId;
    summary: string;
  };
  SupportSession: {
    featureId: FeatureId;
    summary: string;
    /** true のとき MediaProjection 背面支援を開始しようとする（Android のみ） */
    backgroundAssist?: boolean;
  };
  EndSupport: {
    featureId: FeatureId;
    summary: string;
  };
  Settings: undefined;
  Privacy: undefined;
  About: undefined;
};
