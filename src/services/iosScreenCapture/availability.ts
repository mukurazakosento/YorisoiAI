import type { IosScreenCaptureAvailability } from './types';

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
    // Node スモーク等
  }
  if (typeof window !== 'undefined') {
    return 'web';
  }
  return 'unknown';
}

type NativeProbe = {
  linked: boolean;
  supported: boolean;
};

function probeNative(): NativeProbe {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('yorisoi-screencapture') as {
      isScreenCaptureSupported?: () => boolean;
    };
    if (typeof mod.isScreenCaptureSupported !== 'function') {
      return { linked: false, supported: false };
    }
    const supported = mod.isScreenCaptureSupported();
    return { linked: true, supported };
  } catch {
    return { linked: false, supported: false };
  }
}

/**
 * Honest availability for the iOS 27 ScreenCaptureKit demo.
 * Never claims live capture on Web / Android / Expo Go / iOS &lt; 27.
 */
export function getIosScreenCaptureAvailability(): IosScreenCaptureAvailability {
  const os = getRuntimeOs();

  if (os === 'web') {
    return {
      supported: false,
      label: '画面共有：不可（Web）',
      message:
        'iOS の ScreenCaptureKit デモは Web では動きません。Web 試作の画面共有とは別経路です。',
      reason: 'web',
    };
  }

  if (os === 'android') {
    return {
      supported: false,
      label: '画面共有：未対応（Android）',
      message: 'このデモは iPhone（iOS 27+）向けです。',
      reason: 'android',
    };
  }

  if (os !== 'ios') {
    return {
      supported: false,
      label: '画面共有：不可',
      message: 'この環境では画面共有デモを使えません。',
      reason: 'expo-go-or-missing-native',
    };
  }

  const native = probeNative();
  if (!native.linked) {
    return {
      supported: false,
      label: '画面共有：要development build',
      message:
        'ScreenCaptureKit デモは Expo Go では動きません。EAS の development build が必要です。',
      reason: 'expo-go-or-missing-native',
    };
  }

  if (!native.supported) {
    return {
      supported: false,
      label: '画面共有：iOS 27が必要',
      message:
        'この iPhone の iOS では画面共有デモは使えません（iOS 27 が必要です）。',
      reason: 'ios-version-too-low',
    };
  }

  return {
    supported: true,
    label: '画面共有：ScreenCaptureKit可',
    message:
      'システム共有ピッカーで選んだ画面だけを端末内で受け取ります。映像は保存・外部送信しません。',
    reason: 'ok',
  };
}
