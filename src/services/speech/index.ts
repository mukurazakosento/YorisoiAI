import * as Speech from 'expo-speech';

/**
 * 音声案内の境界（Expo Speech / iOS AVSpeechSynthesizer）。
 * displayText とは別に voiceText を読み上げる。消音でも画面文言は別途必須。
 *
 * 状態: idle / speaking / paused
 * 操作: 開始・一時停止・再開・停止・もう一度聞く
 *
 * pause / resume は iOS・Web 向け。未対応環境では停止＋先頭から再開で代替する。
 */

export type SpeechStatus = 'idle' | 'speaking' | 'paused';

export type SpeakOptions = {
  text: string;
  rate: number;
  language?: string;
};

type SpeechSession = {
  text: string;
  rate: number;
  language: string;
};

const DEFAULT_RATE = 0.85;
const DEFAULT_LANGUAGE = 'ja-JP';

let session: SpeechSession | null = null;
let status: SpeechStatus = 'idle';
/** stop() 由来か、pause 代替の stop かを区別する */
let stopIntent: 'none' | 'user_stop' | 'restart' | 'pause_fallback' = 'none';

const listeners = new Set<(next: SpeechStatus) => void>();

function notify(): void {
  for (const listener of listeners) {
    listener(status);
  }
}

function setStatus(next: SpeechStatus): void {
  if (status === next) {
    return;
  }
  status = next;
  notify();
}

export function getSpeechStatus(): SpeechStatus {
  return status;
}

export function getLastSpokenText(): string | null {
  return session?.text ?? null;
}

export function subscribeSpeechStatus(
  listener: (next: SpeechStatus) => void,
): () => void {
  listeners.add(listener);
  listener(status);
  return () => {
    listeners.delete(listener);
  };
}

export function clampSpeechRate(rate: number): number {
  if (!Number.isFinite(rate)) {
    return DEFAULT_RATE;
  }
  return Math.min(1.2, Math.max(0.5, rate));
}

/**
 * 読み上げ開始。直前の発話は止めてから新しい文章を読む。
 */
export async function speak(options: SpeakOptions): Promise<void> {
  const text = options.text.trim();
  if (!text) {
    return;
  }

  const nextSession: SpeechSession = {
    text,
    rate: clampSpeechRate(options.rate),
    language: options.language?.trim() || DEFAULT_LANGUAGE,
  };

  stopIntent = 'restart';
  try {
    await Speech.stop();
  } catch {
    // 停止失敗でも新規読み上げは試みる
  }

  session = nextSession;
  setStatus('speaking');

  Speech.speak(session.text, {
    language: session.language,
    rate: session.rate,
    onStart: () => {
      stopIntent = 'none';
      setStatus('speaking');
    },
    onDone: () => {
      stopIntent = 'none';
      setStatus('idle');
    },
    onStopped: () => {
      if (stopIntent === 'pause_fallback') {
        stopIntent = 'none';
        setStatus('paused');
        return;
      }
      if (stopIntent === 'restart') {
        // speak() 先頭の stop。新しい speak の onStart が続く
        return;
      }
      stopIntent = 'none';
      setStatus('idle');
    },
    onError: () => {
      stopIntent = 'none';
      setStatus('idle');
    },
  });
}

export async function stopSpeaking(): Promise<void> {
  stopIntent = 'user_stop';
  try {
    await Speech.stop();
  } catch {
    // no-op
  }
  stopIntent = 'none';
  setStatus('idle');
}

/**
 * 一時停止。iOS / Web は Expo Speech.pause。
 * 未対応環境では停止し、再開時に同じ文章を先頭から読む。
 */
export async function pauseSpeaking(): Promise<void> {
  if (status !== 'speaking') {
    return;
  }

  try {
    await Speech.pause();
    setStatus('paused');
  } catch {
    stopIntent = 'pause_fallback';
    try {
      await Speech.stop();
    } catch {
      stopIntent = 'none';
      setStatus('paused');
    }
  }
}

/**
 * 再開。pause 済みなら resume。代替 paused なら同じ文章を先頭から speak。
 */
export async function resumeSpeaking(): Promise<void> {
  if (status !== 'paused' || !session) {
    return;
  }

  try {
    await Speech.resume();
    setStatus('speaking');
  } catch {
    const current = session;
    await speak({
      text: current.text,
      rate: current.rate,
      language: current.language,
    });
  }
}

/**
 * 同じ文章をもう一度最初から読む。
 */
export async function replaySpeaking(options?: {
  text?: string;
  rate?: number;
  language?: string;
}): Promise<void> {
  const text = (options?.text ?? session?.text ?? '').trim();
  if (!text) {
    return;
  }

  await speak({
    text,
    rate: options?.rate ?? session?.rate ?? DEFAULT_RATE,
    language: options?.language ?? session?.language ?? DEFAULT_LANGUAGE,
  });
}

export async function isSpeakingNow(): Promise<boolean> {
  try {
    return await Speech.isSpeakingAsync();
  } catch {
    return status === 'speaking' || status === 'paused';
  }
}

/** 消音・音量の高齢者向け説明（画面上の文字は常に出す前提） */
export const SPEECH_MUTE_HELP =
  '音が出ないときは、iPhoneの側面のスイッチ（消音）と側面の音量ボタンを確認してください。消音でも、画面の文字は読めます。';

export const SPEECH_DISABLED_HELP =
  '音声案内はオフです。聞くときは、設定で「音声案内」をオンにしてください。画面の文字はそのまま読めます。';
