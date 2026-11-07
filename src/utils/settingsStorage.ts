import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_SETTINGS,
  type AppSettings,
} from '../types/settings';
import type { FontScaleKey } from '../constants/typography';

const STORAGE_KEY = 'yorisoi.settings.v1';

function isFontScale(value: unknown): value is FontScaleKey {
  return value === 'standard' || value === 'large' || value === 'extraLarge';
}

function sanitizeSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  const candidate = raw as Partial<AppSettings>;
  return {
    voiceEnabled:
      typeof candidate.voiceEnabled === 'boolean'
        ? candidate.voiceEnabled
        : DEFAULT_SETTINGS.voiceEnabled,
    speechRate:
      typeof candidate.speechRate === 'number' &&
      candidate.speechRate >= 0.5 &&
      candidate.speechRate <= 1.2
        ? candidate.speechRate
        : DEFAULT_SETTINGS.speechRate,
    fontScale: isFontScale(candidate.fontScale)
      ? candidate.fontScale
      : DEFAULT_SETTINGS.fontScale,
  };
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) {
      return { ...DEFAULT_SETTINGS };
    }
    return sanitizeSettings(JSON.parse(json));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const next = sanitizeSettings(settings);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
