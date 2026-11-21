import { Platform } from 'react-native';

import type {
  AndroidAssistErrorEvent,
  AndroidAssistFrameEvent,
  AndroidAssistOcrChangedEvent,
  AndroidAssistPermissionResult,
  AndroidAssistPhaseEvent,
  AndroidAssistStartOptions,
  AndroidAssistNativeStatus,
} from './YorisoiAndroidAssist.types';
import { getNativeAndroidAssistModule } from './YorisoiAndroidAssistModule';

export type {
  AndroidAssistErrorEvent,
  AndroidAssistFrameEvent,
  AndroidAssistNativeStatus,
  AndroidAssistOcrChangedEvent,
  AndroidAssistPermissionResult,
  AndroidAssistPhase,
  AndroidAssistPhaseEvent,
  AndroidAssistStartOptions,
} from './YorisoiAndroidAssist.types';

export class AndroidAssistUnavailableError extends Error {
  readonly code = 'ANDROID_ASSIST_UNAVAILABLE';

  constructor(message: string) {
    super(message);
    this.name = 'AndroidAssistUnavailableError';
  }
}

/**
 * True only on Android with the native module linked (EAS / prebuild).
 * Never true on iOS, Web, or Expo Go.
 */
export function isAndroidAssistNativeAvailable(): boolean {
  if (Platform.OS !== 'android') {
    return false;
  }
  const native = getNativeAndroidAssistModule();
  if (!native) {
    return false;
  }
  try {
    return native.isSupported();
  } catch {
    return false;
  }
}

function requireNative(): ReturnType<typeof getNativeAndroidAssistModule> {
  const native = getNativeAndroidAssistModule();
  if (!native || !native.isSupported()) {
    throw new AndroidAssistUnavailableError(
      'Androidの背面支援は、EASのdevelopment / previewビルドでのみ使えます。Expo Go・iPhone・Webでは動きません。',
    );
  }
  return native;
}

export function getAndroidAssistNativeStatus(): AndroidAssistNativeStatus {
  const native = getNativeAndroidAssistModule();
  if (!native) {
    return {
      phase: 'unsupported',
      running: false,
      paused: false,
      frameCount: 0,
      lastGuidance: '',
      lastStepId: '',
      hasOcrText: false,
    };
  }
  return native.getStatus();
}

export async function requestAndroidAssistPermission(): Promise<AndroidAssistPermissionResult> {
  const native = requireNative();
  return native!.requestPermission();
}

export async function startAndroidAssistNative(
  options: AndroidAssistStartOptions,
): Promise<{ ok: boolean; alreadyRunning?: boolean }> {
  const native = requireNative();
  return native!.startAssist(options);
}

export async function pauseAndroidAssistNative(): Promise<void> {
  const native = requireNative();
  await native!.pauseAssist();
}

export async function resumeAndroidAssistNative(): Promise<void> {
  const native = requireNative();
  await native!.resumeAssist();
}

export async function stopAndroidAssistNative(): Promise<void> {
  const native = getNativeAndroidAssistModule();
  if (!native) {
    return;
  }
  await native.stopAssist();
}

export function subscribeAndroidAssistPhase(
  listener: (event: AndroidAssistPhaseEvent) => void,
): () => void {
  const native = getNativeAndroidAssistModule();
  if (!native) {
    return () => undefined;
  }
  const sub = native.addListener('onPhase', listener);
  return () => sub.remove();
}

export function subscribeAndroidAssistFrame(
  listener: (event: AndroidAssistFrameEvent) => void,
): () => void {
  const native = getNativeAndroidAssistModule();
  if (!native) {
    return () => undefined;
  }
  const sub = native.addListener('onFrame', listener);
  return () => sub.remove();
}

export function subscribeAndroidAssistOcrChanged(
  listener: (event: AndroidAssistOcrChangedEvent) => void,
): () => void {
  const native = getNativeAndroidAssistModule();
  if (!native) {
    return () => undefined;
  }
  const sub = native.addListener('onOcrChanged', listener);
  return () => sub.remove();
}

export function subscribeAndroidAssistError(
  listener: (event: AndroidAssistErrorEvent) => void,
): () => void {
  const native = getNativeAndroidAssistModule();
  if (!native) {
    return () => undefined;
  }
  const sub = native.addListener('onError', listener);
  return () => sub.remove();
}
