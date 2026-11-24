import { NativeModule, requireNativeModule } from 'expo-modules-core';

import type {
  DownloadProgressEvent,
  NativeLlmStatus,
} from './YorisoiOnDeviceLlm.types';

type LlmEvents = {
  onDownloadProgress: (event: DownloadProgressEvent) => void;
};

declare class YorisoiOnDeviceLlmNative extends NativeModule<LlmEvents> {
  isSupported(): boolean;
  getStatus(): NativeLlmStatus;
  setDownloadConsent(accepted: boolean): {
    ok: boolean;
    hasConsent?: boolean;
    error?: string;
  };
  startDownload(options?: {
    url?: string;
  }): Promise<{ ok: boolean; path: string; modelId: string }>;
  cancelDownload(): { ok: boolean };
  deleteModel(): { ok: boolean };
  loadModel(): Promise<{
    ok: boolean;
    ready: boolean;
    probe: string;
    modelId: string;
    engine: string;
  }>;
  unloadModel(): { ok: boolean; ready: boolean };
  generate(prompt: string): Promise<{ text: string }>;
}

/**
 * Loads the local Expo native module when an Android EAS / prebuild includes it.
 * Expo Go, iOS, and web have no binary — callers must treat as AI未接続.
 */
export function getNativeOnDeviceLlmModule(): YorisoiOnDeviceLlmNative | null {
  try {
    return requireNativeModule<YorisoiOnDeviceLlmNative>('YorisoiOnDeviceLlm');
  } catch {
    return null;
  }
}

export type { DownloadProgressEvent, NativeLlmStatus };
