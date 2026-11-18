import { getWebCaptureAvailability } from './availability';
import {
  recognizeJapaneseFromCanvas,
  terminateOcrWorker,
} from './tesseractOcr';
import type {
  WebCaptureSessionState,
  WebOcrSnapshot,
  WebSharePhase,
} from './types';

/** 約5秒間隔でフレーム取得 */
export const WEB_FRAME_INTERVAL_MS = 5000;

type Listener = (state: WebCaptureSessionState) => void;

let state: WebCaptureSessionState = createInitialState();
const listeners = new Set<Listener>();

let mediaStream: MediaStream | null = null;
let videoEl: HTMLVideoElement | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let frameTimer: ReturnType<typeof setInterval> | null = null;
let ocrBusy = false;
let visibilityHandler: (() => void) | null = null;
let trackEndedHandler: (() => void) | null = null;

function createInitialState(): WebCaptureSessionState {
  const availability = getWebCaptureAvailability();
  return {
    phase: availability.canStartShare ? 'idle' : 'unavailable',
    availability,
    statusMessage: availability.message,
    sharing: false,
    paused: false,
    tabHidden: false,
    lastOcr: null,
    frameCount: 0,
    errorDetail: null,
  };
}

function emit(): void {
  const snapshot = getWebCaptureSessionState();
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function setState(patch: Partial<WebCaptureSessionState>): void {
  state = { ...state, ...patch };
  emit();
}

export function getWebCaptureSessionState(): WebCaptureSessionState {
  return {
    ...state,
    availability: { ...state.availability },
    lastOcr: state.lastOcr ? { ...state.lastOcr } : null,
  };
}

export function subscribeWebCaptureSession(listener: Listener): () => void {
  listeners.add(listener);
  listener(getWebCaptureSessionState());
  return () => {
    listeners.delete(listener);
  };
}

function clearFrameTimer(): void {
  if (frameTimer != null) {
    clearInterval(frameTimer);
    frameTimer = null;
  }
}

function detachVisibility(): void {
  if (visibilityHandler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', visibilityHandler);
  }
  visibilityHandler = null;
}

function stopTracksOnly(): void {
  if (mediaStream) {
    for (const track of mediaStream.getTracks()) {
      if (trackEndedHandler) {
        track.removeEventListener('ended', trackEndedHandler);
      }
      try {
        track.stop();
      } catch {
        // no-op
      }
    }
  }
  mediaStream = null;
  trackEndedHandler = null;
  if (videoEl) {
    try {
      videoEl.srcObject = null;
    } catch {
      // no-op
    }
  }
  videoEl = null;
  // フレームは保持しない（キャンバスを破棄）
  canvasEl = null;
}

function grabFrameToCanvas(): HTMLCanvasElement | null {
  if (
    typeof document === 'undefined' ||
    !videoEl ||
    videoEl.readyState < 2 ||
    videoEl.videoWidth <= 0
  ) {
    return null;
  }
  const maxW = 1280;
  const scale = Math.min(1, maxW / videoEl.videoWidth);
  const w = Math.max(1, Math.round(videoEl.videoWidth * scale));
  const h = Math.max(1, Math.round(videoEl.videoHeight * scale));
  if (!canvasEl) {
    canvasEl = document.createElement('canvas');
  }
  canvasEl.width = w;
  canvasEl.height = h;
  const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return null;
  }
  ctx.drawImage(videoEl, 0, 0, w, h);
  return canvasEl;
}

async function runOneOcrPass(): Promise<void> {
  if (ocrBusy || state.paused || state.tabHidden || !state.sharing) {
    return;
  }
  const canvas = grabFrameToCanvas();
  if (!canvas) {
    return;
  }

  ocrBusy = true;
  setState({
    phase: 'ocr',
    statusMessage: '画面の文字を読み取っています（ブラウザ内・送信なし）…',
    frameCount: state.frameCount + 1,
  });

  try {
    const result = await recognizeJapaneseFromCanvas(canvas);
    // キャンバス画素を残さない（次フレームで上書き／停止時に破棄）
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    const snapshot: WebOcrSnapshot = {
      text: result.text,
      recognizedAt: Date.now(),
      empty: result.empty,
    };
    setState({
      phase: 'sharing',
      lastOcr: snapshot,
      statusMessage: result.empty
        ? '文字が見つかりませんでした。共有中の画面を確認してください。'
        : '読み取った文字で案内を更新できます（画像は保持しません）。',
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : 'OCRに失敗しました';
    setState({
      phase: 'sharing',
      statusMessage: '文字の読み取りに失敗しました。共有は続いています。',
      errorDetail: detail,
    });
  } finally {
    ocrBusy = false;
  }
}

function startFrameLoop(): void {
  clearFrameTimer();
  void runOneOcrPass();
  frameTimer = setInterval(() => {
    void runOneOcrPass();
  }, WEB_FRAME_INTERVAL_MS);
}

function handleShareEnded(reason: 'ended' | 'hidden'): void {
  clearFrameTimer();
  stopTracksOnly();
  const phase: WebSharePhase = reason === 'hidden' ? 'hidden' : 'ended';
  setState({
    phase,
    sharing: false,
    paused: false,
    tabHidden: reason === 'hidden',
    statusMessage:
      reason === 'hidden'
        ? 'タブが非表示のため画面共有の処理を止めました。背面では動きません。'
        : '画面共有が終了しました。必要ならもう一度「画面共有を開始」を押してください。',
  });
}

/**
 * 利用者開始の画面共有。サイレント開始はしない。
 */
export async function startWebDisplayShare(): Promise<WebCaptureSessionState> {
  const availability = getWebCaptureAvailability();
  if (!availability.canStartShare) {
    setState({
      phase: 'unavailable',
      availability,
      statusMessage: availability.message,
      sharing: false,
    });
    return getWebCaptureSessionState();
  }

  setState({
    phase: 'requesting',
    availability,
    statusMessage: '画面共有の許可を待っています…',
    errorDetail: null,
  });

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
    mediaStream = stream;

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    videoEl = video;

    const [track] = stream.getVideoTracks();
    trackEndedHandler = () => {
      handleShareEnded('ended');
    };
    if (track) {
      track.addEventListener('ended', trackEndedHandler);
    }

    visibilityHandler = () => {
      if (typeof document === 'undefined') {
        return;
      }
      if (document.visibilityState === 'hidden') {
        // 背面では動かないと明示。偽のバックグラウンド処理をしない。
        clearFrameTimer();
        setState({
          tabHidden: true,
          paused: true,
          phase: 'hidden',
          statusMessage:
            'タブが非表示です。画面共有の読み取りは背面では動きません。戻ったら「再開」を押してください。',
        });
        return;
      }
      if (state.sharing && state.tabHidden) {
        setState({
          tabHidden: false,
          statusMessage:
            'タブが再表示されました。「再開」で読み取りを続けられます。',
          phase: 'paused',
          paused: true,
        });
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    setState({
      phase: 'sharing',
      sharing: true,
      paused: false,
      tabHidden: false,
      frameCount: 0,
      lastOcr: null,
      statusMessage:
        '画面共有中です。約5秒ごとに文字を読みます（ブラウザ内のみ）。',
    });
    startFrameLoop();
    return getWebCaptureSessionState();
  } catch (error) {
    stopTracksOnly();
    const detail =
      error instanceof Error ? error.message : '画面共有を開始できませんでした';
    const denied =
      typeof detail === 'string' &&
      /NotAllowed|Permission|denied|キャンセル|cancel/i.test(detail);
    setState({
      phase: 'error',
      sharing: false,
      statusMessage: denied
        ? '画面共有がキャンセルされました。必要なときにもう一度開始できます。'
        : '画面共有を開始できませんでした。',
      errorDetail: detail,
    });
    return getWebCaptureSessionState();
  }
}

export function pauseWebDisplayShare(): void {
  if (!state.sharing) {
    return;
  }
  clearFrameTimer();
  setState({
    paused: true,
    phase: 'paused',
    statusMessage: '読み取りを一時停止しています。画面共有自体は続いています。',
  });
}

export function resumeWebDisplayShare(): void {
  if (!state.sharing || state.tabHidden) {
    if (state.tabHidden) {
      setState({
        statusMessage:
          'タブが非表示のときは再開できません。このタブを前面にしてから再開してください。',
      });
    }
    return;
  }
  setState({
    paused: false,
    phase: 'sharing',
    statusMessage: '読み取りを再開しました。',
  });
  startFrameLoop();
}

export async function stopWebDisplayShare(): Promise<void> {
  clearFrameTimer();
  detachVisibility();
  stopTracksOnly();
  await terminateOcrWorker();
  const availability = getWebCaptureAvailability();
  setState({
    phase: availability.canStartShare ? 'ended' : 'unavailable',
    availability,
    sharing: false,
    paused: false,
    tabHidden: false,
    lastOcr: null,
    statusMessage: availability.canStartShare
      ? '画面共有を停止しました。画像は保持していません。'
      : availability.message,
    errorDetail: null,
  });
}

/** 支援セッション離脱時 */
export async function resetWebCaptureSession(): Promise<void> {
  await stopWebDisplayShare();
  state = createInitialState();
  emit();
}

export function resetWebCaptureSessionForTests(): void {
  clearFrameTimer();
  detachVisibility();
  stopTracksOnly();
  ocrBusy = false;
  state = createInitialState();
  emit();
}
