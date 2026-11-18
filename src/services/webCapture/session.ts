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
/** OCR 中に次フレーム要求が来たら最新だけ残す */
let ocrRerunQueued = false;
let visibilityHandler: (() => void) | null = null;
let trackEndedHandler: (() => void) | null = null;
/** start の世代。拒否・停止後の遅延完了を無視 */
let shareGeneration = 0;

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
  if (state.paused || state.tabHidden || !state.sharing) {
    return;
  }
  if (ocrBusy) {
    // 重複 OCR は走らせず、最新フレームだけ後で取る
    ocrRerunQueued = true;
    return;
  }

  const canvas = grabFrameToCanvas();
  if (!canvas) {
    return;
  }

  ocrBusy = true;
  ocrRerunQueued = false;
  const gen = shareGeneration;
  setState({
    phase: 'ocr',
    statusMessage: '画面の文字を読み取っています（ブラウザ内・送信なし）…',
    frameCount: state.frameCount + 1,
  });

  try {
    const result = await recognizeJapaneseFromCanvas(canvas);
    if (gen !== shareGeneration || !state.sharing) {
      return;
    }
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
      phase: state.paused || state.tabHidden ? state.phase : 'sharing',
      lastOcr: snapshot,
      statusMessage: result.empty
        ? '文字が見つかりませんでした。共有中の画面を確認してください。'
        : '読み取った文字で案内を更新できます（画像は保持しません）。',
      errorDetail: null,
    });
  } catch (error) {
    if (gen !== shareGeneration) {
      return;
    }
    const detail =
      error instanceof Error ? error.message : 'OCRに失敗しました';
    setState({
      phase: state.sharing ? 'sharing' : state.phase,
      statusMessage: detail.includes('もう一度')
        ? detail
        : '文字の読み取りに失敗しました。共有は続いています。もう一度試せます。',
      errorDetail: detail,
    });
  } finally {
    ocrBusy = false;
    if (
      ocrRerunQueued &&
      state.sharing &&
      !state.paused &&
      !state.tabHidden &&
      gen === shareGeneration
    ) {
      ocrRerunQueued = false;
      void runOneOcrPass();
    }
  }
}

function startFrameLoop(): void {
  clearFrameTimer();
  void runOneOcrPass();
  frameTimer = setInterval(() => {
    void runOneOcrPass();
  }, WEB_FRAME_INTERVAL_MS);
}

function handleRemoteShareEnded(): void {
  const gen = shareGeneration;
  shareGeneration += 1;
  clearFrameTimer();
  detachVisibility();
  stopTracksOnly();
  ocrRerunQueued = false;
  void terminateOcrWorker();
  if (gen < 0) {
    // keep type narrow unused
  }
  setState({
    phase: 'ended',
    sharing: false,
    paused: false,
    tabHidden: false,
    statusMessage:
      '画面共有が終了しました。必要ならもう一度「画面共有を開始」を押してください。背面では動きません。',
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

  // 既存共有があれば止めてから開始
  if (state.sharing || mediaStream) {
    await stopWebDisplayShare();
  }

  const gen = ++shareGeneration;

  setState({
    phase: 'requesting',
    availability,
    statusMessage: '画面共有の許可を待っています…',
    errorDetail: null,
    lastOcr: null,
    frameCount: 0,
  });

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });

    if (gen !== shareGeneration) {
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // no-op
        }
      }
      return getWebCaptureSessionState();
    }

    mediaStream = stream;

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    if (gen !== shareGeneration) {
      stopTracksOnly();
      return getWebCaptureSessionState();
    }
    videoEl = video;

    const [track] = stream.getVideoTracks();
    trackEndedHandler = () => {
      handleRemoteShareEnded();
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
        // ストリームは維持し、OCR だけ止める（ユーザーが再開できる）
        clearFrameTimer();
        ocrRerunQueued = false;
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
            'タブが再表示されました。「再開」で読み取りを続けられます。背面OCRは行っていません。',
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
    if (gen === shareGeneration) {
      shareGeneration += 1;
    }
    stopTracksOnly();
    void terminateOcrWorker();
    const detail =
      error instanceof Error ? error.message : '画面共有を開始できませんでした';
    const denied =
      typeof detail === 'string' &&
      /NotAllowed|Permission|denied|キャンセル|cancel/i.test(detail);
    setState({
      phase: 'error',
      sharing: false,
      paused: false,
      tabHidden: false,
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
  ocrRerunQueued = false;
  setState({
    paused: true,
    phase: 'paused',
    statusMessage: '読み取りを一時停止しています。画面共有自体は続いています。',
  });
}

export function resumeWebDisplayShare(): void {
  if (!state.sharing) {
    return;
  }
  if (state.tabHidden || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) {
    setState({
      tabHidden: true,
      paused: true,
      phase: 'hidden',
      statusMessage:
        'タブが非表示のときは再開できません。このタブを前面にしてから再開してください。',
    });
    return;
  }
  setState({
    paused: false,
    tabHidden: false,
    phase: 'sharing',
    statusMessage: '読み取りを再開しました。',
  });
  startFrameLoop();
}

export async function stopWebDisplayShare(): Promise<void> {
  shareGeneration += 1;
  clearFrameTimer();
  detachVisibility();
  stopTracksOnly();
  ocrBusy = false;
  ocrRerunQueued = false;
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
  shareGeneration += 1;
  clearFrameTimer();
  detachVisibility();
  stopTracksOnly();
  ocrBusy = false;
  ocrRerunQueued = false;
  state = createInitialState();
  emit();
}
