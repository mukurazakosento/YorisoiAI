import { getAndroidAssistAvailability } from './availability';
import {
  buildGuidanceFromOcrText,
  shouldAnnounceGuidanceStep,
} from './guidanceFromOcr';
import { assistIntervalForFeature, clampAssistIntervalMs } from './intervals';
import type {
  AndroidAssistGuidance,
  AndroidAssistSessionState,
  StartAndroidAssistInput,
} from './types';

type Listener = (state: AndroidAssistSessionState) => void;

let state: AndroidAssistSessionState = createInitialState();
const listeners = new Set<Listener>();
let unsubs: Array<() => void> = [];

function createInitialState(): AndroidAssistSessionState {
  const availability = getAndroidAssistAvailability();
  return {
    phase: availability.available ? 'idle' : 'unavailable',
    featureId: null,
    goalSummary: '',
    availability,
    frameCount: 0,
    lastGuidance: null,
    statusMessage: availability.available ? null : availability.message,
    errorMessage: null,
  };
}

function emit(): void {
  const snapshot = getAndroidAssistSessionState();
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function setState(patch: Partial<AndroidAssistSessionState>): void {
  state = { ...state, ...patch };
  emit();
}

export function getAndroidAssistSessionState(): AndroidAssistSessionState {
  return {
    ...state,
    availability: { ...state.availability },
    lastGuidance: state.lastGuidance ? { ...state.lastGuidance } : null,
  };
}

export function subscribeAndroidAssistSession(listener: Listener): () => void {
  listeners.add(listener);
  listener(getAndroidAssistSessionState());
  return () => {
    listeners.delete(listener);
  };
}

function clearNativeSubscriptions(): void {
  for (const off of unsubs) {
    try {
      off();
    } catch {
      // no-op
    }
  }
  unsubs = [];
}

async function bindNativeEvents(): Promise<void> {
  clearNativeSubscriptions();
  const assist = await import('yorisoi-android-assist');

  unsubs.push(
    assist.subscribeAndroidAssistPhase((event) => {
      if (event.phase === 'running') {
        setState({
          phase: 'running',
          statusMessage: '背面で画面の文字を読み取り中です（画像は送りません）。',
          errorMessage: null,
        });
      } else if (event.phase === 'paused') {
        setState({
          phase: 'paused',
          statusMessage: '背面支援を一時停止しています。',
        });
      } else if (event.phase === 'stopped') {
        setState({
          phase: 'stopped',
          statusMessage: '背面支援を停止しました。許可は再利用しません。',
        });
      }
    }),
  );

  unsubs.push(
    assist.subscribeAndroidAssistFrame((event) => {
      setState({ frameCount: event.frameCount });
    }),
  );

  unsubs.push(
    assist.subscribeAndroidAssistOcrChanged((event) => {
      const previousId = state.lastGuidance?.stepId;
      const previousStage = state.lastGuidance?.stageId;
      const nextStage = event.stageId ?? null;
      // Native already dedupes; keep JS guard (stage-aware).
      if (
        !shouldAnnounceGuidanceStep(
          previousId,
          event.stepId,
          previousStage,
          nextStage,
        )
      ) {
        return;
      }
      const mode: AndroidAssistGuidance['mode'] =
        event.mode === 'live'
          ? 'live'
          : event.mode === 'demo'
            ? 'demo'
            : 'offline';
      const guidance: AndroidAssistGuidance = {
        stepId: event.stepId,
        stageId: event.stageId,
        displayText: event.displayText,
        voiceText: event.voiceText,
        mode,
        ocrTextPreview:
          event.text.length > 120 ? `${event.text.slice(0, 120)}…` : event.text,
        at: event.timestamp,
      };
      setState({
        lastGuidance: guidance,
        statusMessage:
          mode === 'live'
            ? '画面の文字が変わったので案内を更新しました（端末内AI）。'
            : '画面の文字が変わったので案内を更新しました（デモ判定）。',
      });
    }),
  );

  unsubs.push(
    assist.subscribeAndroidAssistError((event) => {
      setState({
        phase: state.phase === 'running' || state.phase === 'paused' ? state.phase : 'error',
        errorMessage: event.message,
        statusMessage: event.message,
      });
    }),
  );
}

/**
 * Request MediaProjection permission then start the FGS loop.
 * Caller should have shown the consent screen first.
 */
export async function startAndroidAssistSession(
  input: StartAndroidAssistInput,
): Promise<AndroidAssistSessionState> {
  const availability = getAndroidAssistAvailability();
  if (!availability.available) {
    setState({
      phase: 'unavailable',
      availability,
      featureId: input.featureId,
      goalSummary: input.goalSummary,
      statusMessage: availability.message,
      errorMessage: null,
    });
    return getAndroidAssistSessionState();
  }

  setState({
    phase: 'requesting',
    featureId: input.featureId,
    goalSummary: input.goalSummary,
    availability,
    frameCount: 0,
    lastGuidance: null,
    statusMessage: '画面共有の許可を確認しています…',
    errorMessage: null,
  });

  try {
    const assist = await import('yorisoi-android-assist');
    await bindNativeEvents();

    const permission = await assist.requestAndroidAssistPermission();
    if (!permission.granted) {
      setState({
        phase: 'stopped',
        statusMessage:
          '画面共有が許可されなかったため、背面支援は開始しません。手動の読み取りは使えます。',
        errorMessage: null,
      });
      return getAndroidAssistSessionState();
    }

    const intervalMs = clampAssistIntervalMs(
      input.intervalMs ?? assistIntervalForFeature(input.featureId),
    );
    await assist.startAndroidAssistNative({
      featureId: input.featureId,
      goalSummary: input.goalSummary,
      voiceEnabled: input.voiceEnabled !== false,
      intervalMs,
    });

    setState({
      phase: 'running',
      statusMessage:
        '背面支援を開始しました。LINEなどへ切り替えて操作してください。代わりにタップはしません。',
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : '背面支援を開始できませんでした。';
    setState({
      phase: 'error',
      errorMessage: message,
      statusMessage: message,
    });
  }

  return getAndroidAssistSessionState();
}

export async function pauseAndroidAssistSession(): Promise<void> {
  try {
    const assist = await import('yorisoi-android-assist');
    await assist.pauseAndroidAssistNative();
    setState({
      phase: 'paused',
      statusMessage: '背面支援を一時停止しました。',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '一時停止できませんでした。';
    setState({ errorMessage: message, statusMessage: message });
  }
}

export async function resumeAndroidAssistSession(): Promise<void> {
  try {
    const assist = await import('yorisoi-android-assist');
    await assist.resumeAndroidAssistNative();
    setState({
      phase: 'running',
      statusMessage: '背面支援を再開しました。',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '再開できませんでした。';
    setState({ errorMessage: message, statusMessage: message });
  }
}

export async function stopAndroidAssistSession(): Promise<void> {
  clearNativeSubscriptions();
  try {
    const assist = await import('yorisoi-android-assist');
    await assist.stopAndroidAssistNative();
  } catch {
    // still reset local state
  }
  const availability = getAndroidAssistAvailability();
  setState({
    phase: availability.available ? 'stopped' : 'unavailable',
    availability,
    statusMessage: '背面支援を停止しました。許可トークンは破棄しました。',
    errorMessage: null,
  });
}

/**
 * Apply an OCR text sample through the JS guidance helper (tests / fallback).
 */
export function applyOcrTextForTests(ocrText: string): AndroidAssistGuidance | null {
  if (!state.featureId) {
    return null;
  }
  const guidance = buildGuidanceFromOcrText({
    featureId: state.featureId,
    goalSummary: state.goalSummary,
    ocrText,
  });
  setState({ lastGuidance: guidance });
  return guidance;
}

export function resetAndroidAssistSessionForTests(): void {
  clearNativeSubscriptions();
  state = createInitialState();
  emit();
}
