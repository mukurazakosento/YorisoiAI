/**
 * 端末内 OCR サービス境界。
 *
 * Hard rule:
 * - スクリーンショット / 画像バイナリは Gemini・Firebase・クラッシュ解析・その他サーバーへ送らない
 * - 利用者確認後の抽出テキスト（最小限）だけが相談に渡せる
 */
import { Platform } from 'react-native';
import {
  isNativeOcrAvailable,
  OcrNativeUnavailableError,
  recognizeJapaneseText,
} from 'yorisoi-mlkit-ocr';

import { deleteTempImageUri } from './cleanup';
import {
  applyOcrConfirmation,
  assembleConsultationSendText,
  clearOcrAutofill,
  consultationPayloadLooksSafe,
  createEmptyOcrInputState,
} from './consultationText';
import { pickScreenshotFromLibrary } from './imagePicker';
import { buildLayoutHints, mapNativeOcrResult } from './mapResult';
import type {
  OcrAvailability,
  OcrResult,
  PickedScreenshot,
} from './types';

export type {
  OcrAvailability,
  OcrBlock,
  OcrElement,
  OcrLine,
  OcrResult,
  PickedScreenshot,
  PixelBounds,
  RelativeBounds,
} from './types';

export type { OcrInputState } from './consultationText';

export {
  applyOcrConfirmation,
  assembleConsultationSendText,
  buildLayoutHints,
  clearOcrAutofill,
  consultationPayloadLooksSafe,
  createEmptyOcrInputState,
  deleteTempImageUri,
  pickScreenshotFromLibrary,
  OcrNativeUnavailableError,
};

export function getOcrAvailability(): OcrAvailability {
  if (Platform.OS === 'web') {
    return {
      available: false,
      reason: 'web',
      message:
        '文字認識は iPhone の development build（EAS）でのみ使えます。Expo Go や Web では動きません。画像は外部へ送りません。',
    };
  }

  if (!isNativeOcrAvailable()) {
    if (Platform.OS === 'android') {
      return {
        available: false,
        reason: 'android-stub',
        message:
          'Android 向けの文字認識はこれから用意します。いまは iPhone の development build でお使いください。画像は外部へ送っていません。',
      };
    }

    return {
      available: false,
      reason: 'expo-go-or-missing-native',
      message:
        '文字認識には EAS の development build が必要です（Expo Go では使えません）。画像は端末の外へ送っていません。',
    };
  }

  return {
    available: true,
    reason: 'ok',
    message:
      'スクリーンショットの文字を、この端末の中だけで読み取ります。画像は外部へ送りません。',
  };
}

/**
 * 端末内で日本語 OCR を実行する。
 * ネイティブが無い環境では明確なエラーを返し、成功したふりをしない。
 */
export async function recognizeTextFromImageUri(
  imageUri: string,
  imageSize?: { width: number; height: number },
): Promise<OcrResult> {
  const native = await recognizeJapaneseText(imageUri);
  return mapNativeOcrResult(native, imageSize);
}

export type ScreenshotOcrOutcome =
  | { status: 'canceled' }
  | { status: 'denied'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'empty'; message: string; result: OcrResult }
  | { status: 'ready'; result: OcrResult; sourceUri: string }
  | { status: 'error'; message: string };

/**
 * 画像選択 → 端末内 OCR → 一時ファイル削除までをまとめた流れ。
 * 失敗時も画像は外部送信しない。一時ファイルは可能な範囲で削除する。
 */
export async function pickAndRecognizeScreenshot(): Promise<ScreenshotOcrOutcome> {
  const picked = await pickScreenshotFromLibrary();
  if (picked.status === 'canceled') {
    return { status: 'canceled' };
  }
  if (picked.status === 'denied') {
    return { status: 'denied', message: picked.message };
  }

  return recognizePickedScreenshot(picked.asset);
}

export async function recognizePickedScreenshot(
  asset: PickedScreenshot,
): Promise<ScreenshotOcrOutcome> {
  const availability = getOcrAvailability();
  if (!availability.available) {
    await deleteTempImageUri(asset.uri);
    return { status: 'unavailable', message: availability.message };
  }

  try {
    const result = await recognizeTextFromImageUri(asset.uri, {
      width: asset.width ?? 0,
      height: asset.height ?? 0,
    });

    // OCR 完了後すぐに一時画像を消す（画像を保持・送信しない）
    await deleteTempImageUri(asset.uri);

    if (!result.fullText.trim()) {
      return {
        status: 'empty',
        message:
          '文字を読み取れませんでした。明るい画面のスクリーンショットでもう一度試すか、下に文字を書いてください。',
        result,
      };
    }

    return { status: 'ready', result, sourceUri: asset.uri };
  } catch (error) {
    await deleteTempImageUri(asset.uri);

    if (error instanceof OcrNativeUnavailableError) {
      return { status: 'unavailable', message: error.message };
    }

    const message =
      error instanceof Error && error.message
        ? error.message
        : '文字認識に失敗しました。画像は外部へ送っていません。';

    return { status: 'error', message };
  }
}
