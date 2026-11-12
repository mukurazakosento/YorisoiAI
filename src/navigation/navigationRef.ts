import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from '../types/navigation';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToEndSupport(params: {
  featureId: RootStackParamList['EndSupport']['featureId'];
  summary: string;
}): void {
  if (!navigationRef.isReady()) {
    return;
  }
  navigationRef.navigate('EndSupport', params);
}
