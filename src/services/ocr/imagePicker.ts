import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import type { PickedScreenshot } from './types';

export type PickScreenshotResult =
  | { status: 'canceled' }
  | { status: 'denied'; message: string }
  | { status: 'picked'; asset: PickedScreenshot };

/**
 * 写真ライブラリからスクリーンショット等の画像を1枚選ぶ。
 * 画像は端末内の一時 URI としてだけ扱う（アップロードしない）。
 */
export async function pickScreenshotFromLibrary(): Promise<PickScreenshotResult> {
  if (Platform.OS === 'web') {
    // Web でもピッカーは動くが、OCR ネイティブが無い。選択自体は許可する。
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return {
      status: 'denied',
      message:
        '写真へのアクセスが許可されていません。設定から写真の許可をオンにしてください。',
    };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
    // Base64 は作らない（外部送信の誘惑を避ける）。URI のみ端末内で使う。
    base64: false,
    exif: false,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { status: 'canceled' };
  }

  const asset = result.assets[0];
  if (!asset.uri) {
    return {
      status: 'denied',
      message: '画像を取得できませんでした。もう一度お試しください。',
    };
  }

  return {
    status: 'picked',
    asset: {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
    },
  };
}
