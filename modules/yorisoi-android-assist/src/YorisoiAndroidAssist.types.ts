export type AndroidAssistPhase =
  | 'idle'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'error'
  | 'unsupported';

export type AndroidAssistNativeStatus = {
  phase: string;
  running: boolean;
  paused: boolean;
  frameCount: number;
  lastGuidance: string;
  lastStepId?: string;
  hasOcrText: boolean;
};

export type AndroidAssistPermissionResult = {
  granted: boolean;
  alreadyRunning?: boolean;
};

export type AndroidAssistStartOptions = {
  goalSummary: string;
  featureId: string;
  voiceEnabled?: boolean;
  intervalMs?: number;
};

export type AndroidAssistPhaseEvent = {
  phase: string;
  detail?: string;
};

export type AndroidAssistFrameEvent = {
  frameCount: number;
  textLength: number;
  timestamp: number;
};

export type AndroidAssistOcrChangedEvent = {
  text: string;
  displayText: string;
  voiceText: string;
  /** Always "demo" until native Llama is connected. */
  mode: string;
  stepId: string;
  timestamp: number;
};

export type AndroidAssistErrorEvent = {
  code: string;
  message: string;
};

export type YorisoiAndroidAssistNativeModule = {
  isSupported(): boolean;
  getStatus(): AndroidAssistNativeStatus;
  requestPermission(): Promise<AndroidAssistPermissionResult>;
  startAssist(options: AndroidAssistStartOptions): Promise<{ ok: boolean; alreadyRunning?: boolean }>;
  pauseAssist(): Promise<{ ok: boolean }>;
  resumeAssist(): Promise<{ ok: boolean }>;
  stopAssist(): Promise<{ ok: boolean; detail?: string }>;
  addListener(
    eventName: 'onPhase',
    listener: (event: AndroidAssistPhaseEvent) => void,
  ): { remove: () => void };
  addListener(
    eventName: 'onFrame',
    listener: (event: AndroidAssistFrameEvent) => void,
  ): { remove: () => void };
  addListener(
    eventName: 'onOcrChanged',
    listener: (event: AndroidAssistOcrChangedEvent) => void,
  ): { remove: () => void };
  addListener(
    eventName: 'onError',
    listener: (event: AndroidAssistErrorEvent) => void,
  ): { remove: () => void };
};
