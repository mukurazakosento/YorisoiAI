import type { FeatureId } from '../../types/navigation';

export type AndroidAssistAvailabilityReason =
  | 'ok'
  | 'not-android'
  | 'expo-go-or-missing-native'
  | 'web';

export type AndroidAssistAvailability = {
  available: boolean;
  reason: AndroidAssistAvailabilityReason;
  /** Short UI label */
  label: string;
  message: string;
};

export type AndroidAssistSessionPhase =
  | 'idle'
  | 'consent'
  | 'requesting'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'unavailable'
  | 'error';

export type AndroidAssistGuidance = {
  stepId: string;
  /** Screen stage (e.g. line-friends, line-chat, wifi-list). */
  stageId?: string;
  displayText: string;
  voiceText: string;
  /** Never "live" while native Llama is disconnected. */
  mode: 'demo' | 'offline';
  ocrTextPreview: string;
  at: number;
};

export type AndroidAssistSessionState = {
  phase: AndroidAssistSessionPhase;
  featureId: FeatureId | null;
  goalSummary: string;
  availability: AndroidAssistAvailability;
  frameCount: number;
  lastGuidance: AndroidAssistGuidance | null;
  statusMessage: string | null;
  errorMessage: string | null;
};

export type StartAndroidAssistInput = {
  featureId: FeatureId;
  goalSummary: string;
  voiceEnabled?: boolean;
  intervalMs?: number;
};
