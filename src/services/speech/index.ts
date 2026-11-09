/**
 * 音声案内の境界（Expo Speech / AVSpeechSynthesizer）。
 * 第7段階で本格接続する。ここではインターフェースのみ。
 */
export type SpeakOptions = {
  text: string;
  rate: number;
  language?: string;
};

export async function speak(_options: SpeakOptions): Promise<void> {
  throw new Error('音声案内は第7段階で実装します。');
}

export async function stopSpeaking(): Promise<void> {
  // no-op until phase 7
}

export async function pauseSpeaking(): Promise<void> {
  // no-op until phase 7
}

export async function resumeSpeaking(): Promise<void> {
  // no-op until phase 7
}
