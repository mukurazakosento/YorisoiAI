export type IosScreenCapturePhase =
  | 'idle'
  | 'picking'
  | 'streaming'
  | 'background'
  | 'stopped'
  | 'unsupported'
  | 'error';

export type IosScreenCaptureAvailability = {
  /** Native module linked and reports iOS 27+ */
  supported: boolean;
  /** Short one-line status for UI */
  label: string;
  /** Longer honesty message */
  message: string;
  reason:
    | 'ok'
    | 'web'
    | 'android'
    | 'expo-go-or-missing-native'
    | 'ios-version-too-low';
};

export type IosScreenCaptureSessionState = {
  phase: IosScreenCapturePhase;
  availability: IosScreenCaptureAvailability;
  frameCount: number;
  /** Epoch ms from native; 0 if none yet */
  lastFrameAt: number;
  width: number;
  height: number;
  statusMessage: string;
  errorCode: string | null;
  /** AppState while streaming — for UI honesty only; truth is frameCount */
  appState: 'active' | 'background' | 'inactive' | 'unknown';
};
