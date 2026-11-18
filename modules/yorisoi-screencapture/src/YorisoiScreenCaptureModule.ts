import { NativeModule, requireNativeModule } from 'expo-modules-core';

import type {
  ScreenCaptureErrorEvent,
  ScreenCaptureFrameEvent,
  ScreenCapturePhaseEvent,
  ScreenCaptureStatus,
} from './YorisoiScreenCapture.types';

type ScreenCaptureEvents = {
  onFrame: (event: ScreenCaptureFrameEvent) => void;
  onPhase: (event: ScreenCapturePhaseEvent) => void;
  onError: (event: ScreenCaptureErrorEvent) => void;
};

declare class YorisoiScreenCaptureModuleType extends NativeModule<ScreenCaptureEvents> {
  isSupported(): boolean;
  getStatus(): ScreenCaptureStatus;
  startFullDisplayCapture(): Promise<void>;
  stopCapture(): Promise<void>;
}

/**
 * Loads the local Expo native module when a development / EAS build includes it.
 * Expo Go and web have no native binary — callers must handle the missing module.
 */
export function getNativeScreenCaptureModule(): YorisoiScreenCaptureModuleType | null {
  try {
    return requireNativeModule<YorisoiScreenCaptureModuleType>(
      'YorisoiScreenCapture',
    );
  } catch {
    return null;
  }
}
