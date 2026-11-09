import { Platform } from 'react-native';

import type { NativeOcrResult } from './YorisoiMlkitOcr.types';
import { getNativeOcrModule } from './YorisoiMlkitOcrModule';

export type {
  NativeOcrBoundingBox,
  NativeOcrBlock,
  NativeOcrElement,
  NativeOcrLine,
  NativeOcrResult,
} from './YorisoiMlkitOcr.types';

export class OcrNativeUnavailableError extends Error {
  readonly code = 'OCR_NATIVE_UNAVAILABLE';

  constructor(message: string) {
    super(message);
    this.name = 'OcrNativeUnavailableError';
  }
}

/**
 * True only when the native ML Kit Japanese module is linked
 * (development / EAS build on a supported device). Never true in Expo Go or web.
 */
export function isNativeOcrAvailable(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }
  const native = getNativeOcrModule();
  if (!native) {
    return false;
  }
  try {
    return native.isAvailable();
  } catch {
    return false;
  }
}

/**
 * Runs Google ML Kit Text Recognition v2 (Japanese) on-device.
 * Image bytes stay on the device — this module does not upload images.
 */
export async function recognizeJapaneseText(
  imageUri: string,
): Promise<NativeOcrResult> {
  if (!imageUri || typeof imageUri !== 'string') {
    throw new Error('画像の場所が分かりません。もう一度選び直してください。');
  }

  if (Platform.OS === 'web') {
    throw new OcrNativeUnavailableError(
      '文字認識は iPhone の開発用ビルド（EAS development build）でのみ使えます。Web や Expo Go では動きません。画像は外部へ送りません。',
    );
  }

  const native = getNativeOcrModule();
  if (!native) {
    throw new OcrNativeUnavailableError(
      '文字認識のネイティブ機能が組み込まれていません。Expo Go ではなく EAS の development build を使ってください。画像は端末の外へ送っていません。',
    );
  }

  if (!native.isAvailable()) {
    throw new OcrNativeUnavailableError(
      Platform.OS === 'android'
        ? 'Android 向けの文字認識はこれから用意します。いまは iPhone の development build でお使いください。画像は外部へ送っていません。'
        : 'この端末では Google ML Kit の日本語文字認識を使えません。画像は外部へ送っていません。',
    );
  }

  return native.recognizeText(imageUri);
}
