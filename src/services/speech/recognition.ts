import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import { Platform } from 'react-native';

/**
 * 音声入力（音声→文字）の境界。
 * Expo Speech（読み上げ）とは別。expo-speech-recognition を使う。
 *
 * 正直な稼働:
 * - EAS development build / preview APK: 端末の音声認識が使える場合あり
 * - Expo Go: ネイティブモジュール未同梱のため不可のことが多い
 * - Web: ブラウザの SpeechRecognition が使える場合あり（未対応ブラウザは不可）
 * 不可のときは画面で明示し、文字入力へ誘導する（偽の成功なし）。
 */

export type SpeechRecognitionAvailability = {
  usable: boolean;
  /** 高齢者向けの短い説明。usable でも空でよい */
  detail: string;
};

export const SPEECH_RECOGNITION_EXPO_GO_HINT =
  '音声入力は EAS の development build か APK が必要です（Expo Go では動きません）。文字で入力できます。';

export const SPEECH_RECOGNITION_UNAVAILABLE_HINT =
  'この環境では音声認識が使えません。文字で入力してください。';

export const SPEECH_RECOGNITION_PERMISSION_HINT =
  'マイクの許可がありません。設定で許可するか、文字で入力してください。';

export function getSpeechRecognitionAvailability(): SpeechRecognitionAvailability {
  try {
    const usable = ExpoSpeechRecognitionModule.isRecognitionAvailable();
    if (!usable) {
      return {
        usable: false,
        detail:
          Platform.OS === 'web'
            ? 'このブラウザでは音声認識が使えません。文字で入力してください。'
            : SPEECH_RECOGNITION_UNAVAILABLE_HINT,
      };
    }
    return { usable: true, detail: '' };
  } catch {
    return {
      usable: false,
      detail: SPEECH_RECOGNITION_EXPO_GO_HINT,
    };
  }
}

export async function requestSpeechRecognitionPermission(): Promise<{
  granted: boolean;
  detail: string;
}> {
  try {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      return { granted: false, detail: SPEECH_RECOGNITION_PERMISSION_HINT };
    }
    return { granted: true, detail: '' };
  } catch {
    return { granted: false, detail: SPEECH_RECOGNITION_EXPO_GO_HINT };
  }
}

export async function startSpeechRecognition(): Promise<{
  ok: boolean;
  detail: string;
}> {
  const availability = getSpeechRecognitionAvailability();
  if (!availability.usable) {
    return { ok: false, detail: availability.detail };
  }

  const permission = await requestSpeechRecognitionPermission();
  if (!permission.granted) {
    return { ok: false, detail: permission.detail };
  }

  try {
    ExpoSpeechRecognitionModule.start({
      lang: 'ja-JP',
      interimResults: true,
      continuous: false,
    });
    return { ok: true, detail: '' };
  } catch {
    return { ok: false, detail: SPEECH_RECOGNITION_UNAVAILABLE_HINT };
  }
}

export function stopSpeechRecognition(): void {
  try {
    ExpoSpeechRecognitionModule.stop();
  } catch {
    // no-op
  }
}

export function abortSpeechRecognition(): void {
  try {
    ExpoSpeechRecognitionModule.abort();
  } catch {
    // no-op
  }
}

/** 結果イベントからいちばん確からしい文を取り出す */
export function transcriptFromResultEvent(
  event: ExpoSpeechRecognitionResultEvent,
): string {
  const first = event.results?.[0];
  if (!first?.transcript) {
    return '';
  }
  return first.transcript.trim();
}
