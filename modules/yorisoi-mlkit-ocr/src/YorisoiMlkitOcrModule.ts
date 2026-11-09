import { NativeModule, requireNativeModule } from 'expo-modules-core';

import type { NativeOcrResult } from './YorisoiMlkitOcr.types';

declare class YorisoiMlkitOcrModule extends NativeModule {
  isAvailable(): boolean;
  recognizeText(imageUri: string): Promise<NativeOcrResult>;
}

/**
 * Loads the local Expo native module when a development / EAS build includes it.
 * Expo Go and web have no native binary — callers must handle the missing module.
 */
export function getNativeOcrModule(): YorisoiMlkitOcrModule | null {
  try {
    return requireNativeModule<YorisoiMlkitOcrModule>('YorisoiMlkitOcr');
  } catch {
    return null;
  }
}
