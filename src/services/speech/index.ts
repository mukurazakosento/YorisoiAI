import * as Speech from 'expo-speech';

/**
 * 音声案内の境界（Expo Speech / AVSpeechSynthesizer）。
 * Phase 5 では案内の読み上げを軽く接続。一時停止・再開などの本格 UX は第7段階。
 */
export type SpeakOptions = {
  text: string;
  rate: number;
  language?: string;
};

export async function speak(options: SpeakOptions): Promise<void> {
  const text = options.text.trim();
  if (!text) {
    return;
  }

  await stopSpeaking();

  Speech.speak(text, {
    language: options.language ?? 'ja-JP',
    rate: clampRate(options.rate),
  });
}

export async function stopSpeaking(): Promise<void> {
  const speaking = await Speech.isSpeakingAsync();
  if (speaking) {
    Speech.stop();
  }
}

export async function pauseSpeaking(): Promise<void> {
  // Phase 7: Expo Speech の pause 対応を本格化する
  await stopSpeaking();
}

export async function resumeSpeaking(): Promise<void> {
  // Phase 7 で実装（いまは no-op）
}

function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) {
    return 0.85;
  }
  return Math.min(1.2, Math.max(0.5, rate));
}
