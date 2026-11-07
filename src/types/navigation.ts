export type FeatureId = 'operationSupport' | 'textExplanation' | 'safetyCheck';

export type RootStackParamList = {
  Home: undefined;
  Consultation: { featureId: FeatureId };
  Settings: undefined;
  Privacy: undefined;
  About: undefined;
};
