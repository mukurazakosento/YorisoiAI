export type ScreenCapturePhase =
  | 'idle'
  | 'picking'
  | 'streaming'
  | 'background'
  | 'stopped'
  | 'unsupported'
  | 'error';

export type ScreenCaptureStatus = {
  phase: ScreenCapturePhase | string;
  frameCount: number;
  /** Epoch milliseconds; 0 when no frame yet */
  lastFrameAt: number;
  width?: number;
  height?: number;
  supported?: boolean;
  errorCode?: string;
};

export type ScreenCaptureFrameEvent = {
  frameCount: number;
  width: number;
  height: number;
  timestamp: number;
};

export type ScreenCapturePhaseEvent = {
  phase: ScreenCapturePhase | string;
  errorCode?: string | null;
};

export type ScreenCaptureErrorEvent = {
  code: string;
  message: string;
};
