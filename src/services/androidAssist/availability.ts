import type { AndroidAssistAvailability } from './types';

type RuntimeOs = 'ios' | 'android' | 'web' | 'unknown';

function getRuntimeOs(): RuntimeOs {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native') as { Platform?: { OS?: string } };
    const os = rn.Platform?.OS;
    if (os === 'ios' || os === 'android' || os === 'web') {
      return os;
    }
  } catch {
    // Node smoke
  }
  if (typeof window !== 'undefined') {
    return 'web';
  }
  return 'unknown';
}

function probeNative(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('yorisoi-android-assist') as {
      isAndroidAssistNativeAvailable?: () => boolean;
    };
    if (typeof mod.isAndroidAssistNativeAvailable === 'function') {
      return mod.isAndroidAssistNativeAvailable();
    }
  } catch {
    // Expo Go / Node / iOS
  }
  return false;
}

/**
 * Android MediaProjection 背面支援の利用可否。
 * iOS / Web / Expo Go では false（動いているように見せない）。
 */
export function getAndroidAssistAvailability(): AndroidAssistAvailability {
  const os = getRuntimeOs();

  if (os === 'web') {
    return {
      available: false,
      reason: 'web',
      label: '背面支援：不可（Web）',
      message:
        'Androidの画面共有による背面支援は Web では使えません。',
    };
  }

  if (os !== 'android') {
    return {
      available: false,
      reason: 'not-android',
      label: '背面支援：Androidのみ',
      message:
        '背面での自動読み取りは Android の EAS ビルド向けです。iPhone では使えません。',
    };
  }

  if (!probeNative()) {
    return {
      available: false,
      reason: 'expo-go-or-missing-native',
      label: '背面支援：要EASビルド',
      message:
        '背面支援には EAS の development / preview APK が必要です（Expo Go では動きません）。手動のスクショ読み取りは別途使えます。',
    };
  }

  return {
    available: true,
    reason: 'ok',
    label: '背面支援：利用可',
    message:
      '画面共有の許可後、よりそいAIを背面にしても画面の文字を読み、変化したときだけ案内します（操作支援は約20秒、文章説明のポップアップはより短い間隔）。画像は端末の外へ送りません。代わりにタップや送信はしません。',
  };
}
