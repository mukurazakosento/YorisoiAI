import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import type { YorisoiAndroidAssistNativeModule } from './YorisoiAndroidAssist.types';

export function getNativeAndroidAssistModule(): YorisoiAndroidAssistNativeModule | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  try {
    return requireNativeModule<YorisoiAndroidAssistNativeModule>(
      'YorisoiAndroidAssist',
    );
  } catch {
    return null;
  }
}
