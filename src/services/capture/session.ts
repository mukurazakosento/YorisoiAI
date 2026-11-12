import type { FeatureId } from '../../types/navigation';
import { getCaptureAvailability } from './availability';
import { getFeatureCapturePath } from './featurePaths';
import type {
  CaptureAvailability,
  CaptureSessionPhase,
  ConfirmedFrameText,
  FrameOcrDraft,
} from './types';

type ScreenshotOcrOutcome = Awaited<
  ReturnType<
    typeof import('../ocr').pickAndRecognizeScreenshot
  >
>;

async function pickFrameViaOcr(): Promise<ScreenshotOcrOutcome> {
  // 遅延 import: Node スモークで OCR ネイティブ／RN が無くても session API を検証できる
  const { pickAndRecognizeScreenshot } = await import('../ocr');
  return pickAndRecognizeScreenshot();
}

export type CaptureSessionState = {
  phase: CaptureSessionPhase;
  featureId: FeatureId | null;
  availability: CaptureAvailability;
  draft: FrameOcrDraft | null;
  confirmed: ConfirmedFrameText | null;
  statusMessage: string | null;
  /** 都度読み取りの案内回数（自動スパイではない） */
  framePromptCount: number;
};

type Listener = (state: CaptureSessionState) => void;

let state: CaptureSessionState = createInitialState();
const listeners = new Set<Listener>();

function createInitialState(): CaptureSessionState {
  const availability = getCaptureAvailability();
  return {
    phase: availability.manualFrameAvailable ? 'idle' : 'unavailable',
    featureId: null,
    availability,
    draft: null,
    confirmed: null,
    statusMessage: availability.manualFrameAvailable
      ? null
      : availability.message,
    framePromptCount: 0,
  };
}

function emit(): void {
  const snapshot = getCaptureSessionState();
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function setState(patch: Partial<CaptureSessionState>): void {
  state = { ...state, ...patch };
  emit();
}

export function getCaptureSessionState(): CaptureSessionState {
  return { ...state, availability: { ...state.availability } };
}

export function subscribeCaptureSession(listener: Listener): () => void {
  listeners.add(listener);
  listener(getCaptureSessionState());
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 支援セッション開始時に呼ぶ。収録の自動開始はしない（ユーザー開始のみ）。
 */
export function startCaptureSession(featureId: FeatureId): CaptureSessionState {
  const availability = getCaptureAvailability();
  if (!availability.manualFrameAvailable) {
    setState({
      phase: 'unavailable',
      featureId,
      availability,
      draft: null,
      confirmed: null,
      statusMessage: availability.message,
      framePromptCount: 0,
    });
    return getCaptureSessionState();
  }

  const path = getFeatureCapturePath(featureId);
  setState({
    phase: 'active',
    featureId,
    availability,
    draft: null,
    confirmed: null,
    statusMessage: path.hint,
    framePromptCount: 0,
  });
  return getCaptureSessionState();
}

export function stopCaptureSession(): void {
  const availability = getCaptureAvailability();
  setState({
    phase: availability.manualFrameAvailable ? 'stopped' : 'unavailable',
    featureId: state.featureId,
    availability,
    draft: null,
    // 確認済み文字はセッション終了で破棄（画像はもともと保持しない）
    confirmed: null,
    statusMessage: null,
    framePromptCount: state.framePromptCount,
  });
}

/**
 * 利用者が明示的にフレームを取り込む。サイレント取得はしない。
 * ImagePicker → 端末内 OCR。画像は OCR 後に削除（ocr サービス側）。
 */
export async function requestUserFrame(): Promise<CaptureSessionState> {
  const availability = getCaptureAvailability();
  if (!availability.manualFrameAvailable || !state.featureId) {
    setState({
      phase: 'unavailable',
      availability,
      statusMessage: availability.message,
    });
    return getCaptureSessionState();
  }

  setState({
    phase: 'picking',
    availability,
    statusMessage: '写真から画面を選んでいます…',
    framePromptCount: state.framePromptCount + 1,
  });

  const outcome = await pickFrameViaOcr();

  if (outcome.status === 'canceled') {
    setState({
      phase: 'active',
      statusMessage: getFeatureCapturePath(state.featureId!).hint,
    });
    return getCaptureSessionState();
  }

  if (
    outcome.status === 'denied' ||
    outcome.status === 'unavailable' ||
    outcome.status === 'error'
  ) {
    setState({
      phase: 'active',
      statusMessage: outcome.message,
    });
    return getCaptureSessionState();
  }

  if (outcome.status === 'empty') {
    setState({
      phase: 'review',
      draft: { text: '' },
      statusMessage: outcome.message,
    });
    return getCaptureSessionState();
  }

  // ready — 生 OCR はドラフトのみ。案内へは confirm まで渡さない
  setState({
    phase: 'review',
    draft: { text: outcome.result.fullText },
    statusMessage:
      '読み取った文字を確認・直してから「この文字で進む」を押してください。画像は送りません。',
  });
  return getCaptureSessionState();
}

export function updateFrameDraft(text: string): void {
  if (state.phase !== 'review') {
    return;
  }
  setState({
    draft: { text },
  });
}

/**
 * 確認済みテキストだけを保持。画像・生OCR構造は持たない。
 */
export function confirmFrameText(text?: string): ConfirmedFrameText | null {
  if (!state.featureId) {
    return null;
  }
  const raw = (text ?? state.draft?.text ?? '').trim();
  if (!raw) {
    setState({
      phase: 'active',
      draft: null,
      statusMessage: '文字が空です。もう一度画面を読み取るか、文を書いてください。',
    });
    return null;
  }

  const confirmed: ConfirmedFrameText = {
    text: raw,
    confirmedAt: Date.now(),
    featureId: state.featureId,
  };
  setState({
    phase: 'active',
    draft: null,
    confirmed,
    statusMessage: '確認した文字を案内に使います（画像は使いません）。',
  });
  return confirmed;
}

export function clearFrameDraft(): void {
  if (!state.featureId) {
    return;
  }
  setState({
    phase: 'active',
    draft: null,
    statusMessage: getFeatureCapturePath(state.featureId).hint,
  });
}

export function getConfirmedFrameText(): string | null {
  const text = state.confirmed?.text?.trim();
  return text ? text : null;
}

/** テスト用リセット */
export function resetCaptureSessionForTests(): void {
  state = createInitialState();
  emit();
}
