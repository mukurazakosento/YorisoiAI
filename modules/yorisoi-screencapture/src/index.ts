import { Platform } from 'react-native';

import type {
  ScreenCaptureErrorEvent,
  ScreenCaptureFrameEvent,
  ScreenCapturePhaseEvent,
  ScreenCaptureStatus,
} from './YorisoiScreenCapture.types';
import { getNativeScreenCaptureModule } from './YorisoiScreenCaptureModule';

export type {
  ScreenCaptureErrorEvent,
  ScreenCaptureFrameEvent,
  ScreenCapturePhase,
  ScreenCapturePhaseEvent,
  ScreenCaptureStatus,
} from './YorisoiScreenCapture.types';

export class ScreenCaptureNativeUnavailableError extends Error {
  readonly code = 'SCREEN_CAPTURE_NATIVE_UNAVAILABLE';

  constructor(message: string) {
    super(message);
    this.name = 'ScreenCaptureNativeUnavailableError';
  }
}

/**
 * True only on iOS 27+ when the native ScreenCaptureKit module is linked
 * (development / EAS build). Never true in Expo Go, web, or Android.
 */
export function isScreenCaptureSupported(): boolean {
  if (Platform.OS !== 'ios') {
    return false;
  }
  const native = getNativeScreenCaptureModule();
  if (!native) {
    return false;
  }
  try {
    return native.isSupported();
  } catch {
    return false;
  }
}

export function getScreenCaptureStatus(): ScreenCaptureStatus {
  const native = getNativeScreenCaptureModule();
  if (!native) {
    return {
      phase: 'unsupported',
      frameCount: 0,
      lastFrameAt: 0,
      supported: false,
      errorCode: 'native_missing',
    };
  }
  try {
    return native.getStatus();
  } catch {
    return {
      phase: 'unsupported',
      frameCount: 0,
      lastFrameAt: 0,
      supported: false,
      errorCode: 'status_failed',
    };
  }
}

export async function startFullDisplayCapture(): Promise<void> {
  if (Platform.OS !== 'ios') {
    throw new ScreenCaptureNativeUnavailableError(
      '画面共有デモは iPhone の development build（iOS 27+）でのみ使えます。',
    );
  }
  const native = getNativeScreenCaptureModule();
  if (!native) {
    throw new ScreenCaptureNativeUnavailableError(
      '画面共有のネイティブ機能が組み込まれていません。Expo Go ではなく EAS の development build を使ってください。',
    );
  }
  if (!native.isSupported()) {
    throw new ScreenCaptureNativeUnavailableError(
      'この iPhone の iOS では画面共有デモは使えません（iOS 27 が必要です）。',
    );
  }
  await native.startFullDisplayCapture();
}

export async function stopScreenCapture(): Promise<void> {
  const native = getNativeScreenCaptureModule();
  if (!native) {
    return;
  }
  await native.stopCapture();
}

export function subscribeScreenCaptureFrame(
  listener: (event: ScreenCaptureFrameEvent) => void,
): () => void {
  const native = getNativeScreenCaptureModule();
  if (!native) {
    return () => undefined;
  }
  const sub = native.addListener('onFrame', listener);
  return () => sub.remove();
}

export function subscribeScreenCapturePhase(
  listener: (event: ScreenCapturePhaseEvent) => void,
): () => void {
  const native = getNativeScreenCaptureModule();
  if (!native) {
    return () => undefined;
  }
  const sub = native.addListener('onPhase', listener);
  return () => sub.remove();
}

export function subscribeScreenCaptureError(
  listener: (event: ScreenCaptureErrorEvent) => void,
): () => void {
  const native = getNativeScreenCaptureModule();
  if (!native) {
    return () => undefined;
  }
  const sub = native.addListener('onError', listener);
  return () => sub.remove();
}
