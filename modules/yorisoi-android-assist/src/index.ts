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

/** True when the optional dialog AccessibilityService is enabled in system settings. */
export function isAndroidDialogAccessibilityEnabled(): boolean {
  const native = getNativeAndroidAssistModule();
  if (!native?.isDialogAccessibilityEnabled) {
    return false;
  }
  try {
    return native.isDialogAccessibilityEnabled();
  } catch {
    return false;
  }
}

/** Opens Android Accessibility settings so the user can enable dialog text reading. */
export async function openAndroidDialogAccessibilitySettings(): Promise<void> {
  const native = requireNative();
  if (!native?.openDialogAccessibilitySettings) {
    throw new AndroidAssistUnavailableError(
      'このビルドではシステム許可ダイアログ用の読み取り設定を開けません。',
    );
  }
  await native.openDialogAccessibilitySettings();
}

/**
 * Arm one-shot safety screen text read (phone | email).
 * No-op on iOS / Web / when native helpers are missing.
 */
export function armSafetyScreenRead(mode: 'phone' | 'email'): boolean {
  const native = getNativeAndroidAssistModule();
  if (!native?.armSafetyScreenRead) {
    return false;
  }
  try {
    const result = native.armSafetyScreenRead(mode);
    return Boolean(result?.ok);
  } catch {
    return false;
  }
}

export function disarmSafetyScreenRead(): void {
  const native = getNativeAndroidAssistModule();
  if (!native?.disarmSafetyScreenRead) {
    return;
  }
  try {
    native.disarmSafetyScreenRead();
  } catch {
    // no-op
  }
}

export function isSafetyScreenReadArmed(): boolean {
  const native = getNativeAndroidAssistModule();
  if (!native?.isSafetyScreenReadArmed) {
    return false;
  }
  try {
    return Boolean(native.isSafetyScreenReadArmed());
  } catch {
    return false;
  }
}

/**
 * One-shot peek of active window text when safety mode is armed.
 * Prefers AccessibilityService; never auto-dials or auto-sends mail.
 */
export function peekSafetyScreenText(): {
  text: string;
  source: string;
  mode: string;
  detail: string;
} {
  const native = getNativeAndroidAssistModule();
  if (!native?.peekSafetyScreenText) {
    return {
      text: '',
      source: 'none',
      mode: '',
      detail: 'この端末では画面文字の直接読み取りが使えません。',
    };
  }
  try {
    const result = native.peekSafetyScreenText();
    return {
      text: (result?.text ?? '').trim(),
      source: result?.source ?? 'none',
      mode: result?.mode ?? '',
      detail: result?.detail ?? '',
    };
  } catch {
    return {
      text: '',
      source: 'none',
      mode: '',
      detail: '画面の文字を読めませんでした。',
    };
  }
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
