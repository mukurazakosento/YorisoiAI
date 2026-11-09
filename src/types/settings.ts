import type { FontScaleKey } from '../constants/typography';

export type AppSettings = {
  /** 音声案内のオン・オフ */
  voiceEnabled: boolean;
  /**
   * Expo Speech の rate。初期値はややゆっくり。
   * 目安: 0.7（ゆっくり）〜 1.1（やや速め）
   */
  speechRate: number;
  fontScale: FontScaleKey;
};

export const DEFAULT_SETTINGS: AppSettings = {
  voiceEnabled: true,
  speechRate: 0.85,
  fontScale: 'standard',
};

export const SPEECH_RATE_OPTIONS = [
  { label: 'ゆっくり', value: 0.7 },
  { label: 'ややゆっくり', value: 0.85 },
  { label: 'ふつう', value: 1.0 },
] as const;
