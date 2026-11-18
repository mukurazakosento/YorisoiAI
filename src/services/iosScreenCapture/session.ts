import { getIosScreenCaptureAvailability } from './availability';
import type {
  IosScreenCapturePhase,
  IosScreenCaptureSessionState,
} from './types';

type Listener = (state: IosScreenCaptureSessionState) => void;

type AppStateStatus = 'active' | 'background' | 'inactive' | 'unknown' | string;

let state: IosScreenCaptureSessionState = createInitialState();
const listeners = new Set<Listener>();
let nativeUnsubs: Array<() => void> = [];
let appStateSub: { remove: () => void } | null = null;
let wired = false;

function createInitialState(): IosScreenCaptureSessionState {
  const availability = getIosScreenCaptureAvailability();
  return {
    phase: availability.supported ? 'idle' : 'unsupported',
    availability,
    frameCount: 0,
    lastFrameAt: 0,
    width: 0,
    height: 0,
    statusMessage: availability.message,
    errorCode: null,
    appState: 'unknown',
  };
}

function emit(): void {
  const snapshot = getIosScreenCaptureSessionState();
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function setState(patch: Partial<IosScreenCaptureSessionState>): void {
  state = { ...state, ...patch };
  emit();
}

function mapAppState(next: AppStateStatus): IosScreenCaptureSessionState['appState'] {
  if (next === 'active' || next === 'background' || next === 'inactive') {
    return next;
  }
  return 'unknown';
}

function ensureNativeWiring(): void {
  if (wired) {
    return;
  }
  wired = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('yorisoi-screencapture') as {
      subscribeScreenCaptureFrame?: (
        cb: (e: {
          frameCount: number;
          width: number;
          height: number;
          timestamp: number;
        }) => void,
      ) => () => void;
      subscribeScreenCapturePhase?: (
        cb: (e: { phase: string; errorCode?: string | null }) => void,
      ) => () => void;
      subscribeScreenCaptureError?: (
        cb: (e: { code: string; message: string }) => void,
      ) => () => void;
      getScreenCaptureStatus?: () => {
        phase?: string;
        frameCount?: number;
        lastFrameAt?: number;
        width?: number;
        height?: number;
        errorCode?: string;
      };
    };

    if (typeof mod.subscribeScreenCaptureFrame === 'function') {
      nativeUnsubs.push(
        mod.subscribeScreenCaptureFrame((event) => {
          setState({
            frameCount: event.frameCount,
            lastFrameAt: event.timestamp,
            width: event.width,
            height: event.height,
          });
        }),
      );
    }

    if (typeof mod.subscribeScreenCapturePhase === 'function') {
      nativeUnsubs.push(
        mod.subscribeScreenCapturePhase((event) => {
          const phase = normalizePhase(event.phase);
          setState({
            phase,
            errorCode: event.errorCode ?? state.errorCode,
            statusMessage: messageForPhase(phase, event.errorCode),
          });
        }),
      );
    }

    if (typeof mod.subscribeScreenCaptureError === 'function') {
      nativeUnsubs.push(
        mod.subscribeScreenCaptureError((event) => {
          setState({
            errorCode: event.code,
            statusMessage: event.message,
            phase:
              event.code === 'canceled' || event.code === 'CANCELED'
                ? 'stopped'
                : state.phase === 'picking'
                  ? 'error'
                  : state.phase,
          });
        }),
      );
    }

    if (typeof mod.getScreenCaptureStatus === 'function') {
      const snap = mod.getScreenCaptureStatus();
      setState({
        phase: normalizePhase(snap.phase ?? state.phase),
        frameCount: snap.frameCount ?? state.frameCount,
        lastFrameAt: snap.lastFrameAt ?? state.lastFrameAt,
        width: snap.width ?? state.width,
        height: snap.height ?? state.height,
        errorCode: snap.errorCode ?? state.errorCode,
      });
    }
  } catch {
    // Expo Go / Node smoke — stay on unsupported
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native') as {
      AppState?: {
        addEventListener: (
          type: string,
          listener: (state: AppStateStatus) => void,
        ) => { remove: () => void };
      };
    };
    appStateSub =
      rn.AppState?.addEventListener('change', (next) => {
        const appState = mapAppState(next);
        const patch: Partial<IosScreenCaptureSessionState> = { appState };
        if (
          (state.phase === 'streaming' || state.phase === 'background') &&
          appState === 'background'
        ) {
          patch.phase = 'background';
          patch.statusMessage =
            '背面でもフレーム受信を続けます（戻ったら件数で確認できます）。';
        } else if (state.phase === 'background' && appState === 'active') {
          patch.phase = 'streaming';
          patch.statusMessage =
            '共有中です。frameCount と lastFrameAt が増えていれば背面でも受信できています。';
        }
        setState(patch);
      }) ?? null;
  } catch {
    // Node smoke
  }
}

function normalizePhase(raw: string): IosScreenCapturePhase {
  switch (raw) {
    case 'idle':
    case 'picking':
    case 'streaming':
    case 'background':
    case 'stopped':
    case 'unsupported':
    case 'error':
      return raw;
    default:
      return 'idle';
  }
}

function messageForPhase(
  phase: IosScreenCapturePhase,
  errorCode?: string | null,
): string {
  switch (phase) {
    case 'picking':
      return 'システム共有ピッカーで画面を選んでください。';
    case 'streaming':
      return '共有中です。ほかのアプリへ切り替えても件数が増えるか確認できます。';
    case 'background':
      return '背面でもフレーム受信を続けます（戻ったら件数で確認できます）。';
    case 'stopped':
      return errorCode === 'canceled' || errorCode === 'CANCELED'
        ? '画面共有の選択をキャンセルしました。'
        : '画面共有を停止しました。';
    case 'error':
      return '画面共有でエラーが起きました。';
    case 'unsupported':
      return getIosScreenCaptureAvailability().message;
    default:
      return getIosScreenCaptureAvailability().message;
  }
}

export function getIosScreenCaptureSessionState(): IosScreenCaptureSessionState {
  return {
    ...state,
    availability: { ...state.availability },
  };
}

export function subscribeIosScreenCaptureSession(
  listener: Listener,
): () => void {
  ensureNativeWiring();
  listeners.add(listener);
  listener(getIosScreenCaptureSessionState());
  return () => {
    listeners.delete(listener);
  };
}

export async function startIosScreenCaptureKit(): Promise<IosScreenCaptureSessionState> {
  ensureNativeWiring();
  const availability = getIosScreenCaptureAvailability();
  if (!availability.supported) {
    setState({
      phase: 'unsupported',
      availability,
      statusMessage: availability.message,
      errorCode: availability.reason,
    });
    return getIosScreenCaptureSessionState();
  }

  setState({
    availability,
    phase: 'picking',
    statusMessage: messageForPhase('picking'),
    errorCode: null,
    frameCount: 0,
    lastFrameAt: 0,
    width: 0,
    height: 0,
  });

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('yorisoi-screencapture') as {
      startFullDisplayCapture: () => Promise<void>;
    };
    await mod.startFullDisplayCapture();
    if (state.phase === 'picking') {
      setState({
        phase: 'streaming',
        statusMessage: messageForPhase('streaming'),
      });
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : '画面共有を開始できませんでした。';
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: string }).code ?? '')
        : '';
    const canceled = /cancel/i.test(message) || /CANCELED/i.test(code);
    setState({
      phase: canceled ? 'stopped' : 'error',
      statusMessage: message,
      errorCode: canceled ? 'canceled' : 'start_failed',
    });
  }

  return getIosScreenCaptureSessionState();
}

export async function stopIosScreenCaptureKit(): Promise<IosScreenCaptureSessionState> {
  ensureNativeWiring();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('yorisoi-screencapture') as {
      stopScreenCapture: () => Promise<void>;
    };
    await mod.stopScreenCapture();
  } catch {
    // Still mark stopped for honesty
  }
  setState({
    phase: 'stopped',
    statusMessage: messageForPhase('stopped'),
  });
  return getIosScreenCaptureSessionState();
}

/** Test / smoke reset */
export function resetIosScreenCaptureSessionForTests(): void {
  for (const unsub of nativeUnsubs) {
    unsub();
  }
  nativeUnsubs = [];
  appStateSub?.remove();
  appStateSub = null;
  wired = false;
  state = createInitialState();
  emit();
}
