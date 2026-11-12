import { CAPTURE_LIMITS_SHORT } from './limits';
import { isBroadcastUploadLinked } from './broadcast';
import type { CaptureAvailability } from './types';

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

type OcrProbe = {
  available: boolean;
  message: string;
};

/**
 * OCR 境界を安全に参照する（Node スモークで react-native が無い場合も落とさない）。
 */
function probeOcrAvailability(): OcrProbe {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ocr = require('../ocr') as {
      getOcrAvailability?: () => { available: boolean; message: string };
    };
    if (typeof ocr.getOcrAvailability === 'function') {
      const result = ocr.getOcrAvailability();
      return { available: result.available, message: result.message };
    }
  } catch {
    // Expo Go 未リンク / Node スモーク
  }
  return {
    available: false,
    message: CAPTURE_LIMITS_SHORT.expoGoWeb,
  };
}

/**
 * 画面収録・フレーム OCR の利用可否。
 * Expo Go / Web では live 収録を主張しない。Broadcast 未リンクも偽らない。
 */
export function getCaptureAvailability(): CaptureAvailability {
  const broadcastLinked = isBroadcastUploadLinked();
  const os = getRuntimeOs();
  const ocr = probeOcrAvailability();

  if (os === 'web') {
    return {
      manualFrameAvailable: false,
      broadcastUploadLinked: false,
      periodicAutoFramesAvailable: false,
      capability: 'unavailable',
      recordingLabel: '画面収録：不可（Web）',
      periodicOcrLabel: '定期OCR：不可（Web）',
      message: CAPTURE_LIMITS_SHORT.expoGoWeb,
      reason: 'web',
    };
  }

  if (!ocr.available) {
    const android = os === 'android';
    return {
      manualFrameAvailable: false,
      broadcastUploadLinked: broadcastLinked,
      periodicAutoFramesAvailable: false,
      capability: 'unavailable',
      recordingLabel: android
        ? '画面収録：制限あり'
        : '画面収録：要development build',
      periodicOcrLabel: android
        ? '定期OCR：未対応'
        : '定期OCR：要development build',
      message: android
        ? `${ocr.message} ${CAPTURE_LIMITS_SHORT.cannotOneLiner}`
        : CAPTURE_LIMITS_SHORT.expoGoWeb,
      reason: android ? 'android-limited' : 'expo-go-or-missing-ocr',
    };
  }

  if (broadcastLinked) {
    return {
      manualFrameAvailable: true,
      broadcastUploadLinked: true,
      periodicAutoFramesAvailable: true,
      capability: 'broadcast_upload',
      recordingLabel: '画面収録：Broadcast利用可',
      periodicOcrLabel: '定期OCR：フレーム待ち',
      message:
        'ユーザー開始の Broadcast Upload からフレームを受け取り、端末内だけで文字を読みます。',
      reason: 'ok-manual',
    };
  }

  return {
    manualFrameAvailable: true,
    broadcastUploadLinked: false,
    periodicAutoFramesAvailable: false,
    capability: 'manual_screenshot_ocr',
    recordingLabel: '画面収録：利用者開始のみ',
    periodicOcrLabel: '定期OCR：都度読み取り',
    message: `${CAPTURE_LIMITS_SHORT.canOneLiner} ${CAPTURE_LIMITS_SHORT.broadcastNotLinked}`,
    reason: 'ok-manual',
  };
}

export function assertCaptureHonesty(availability: CaptureAvailability): boolean {
  if (availability.capability === 'unavailable') {
    return (
      !availability.manualFrameAvailable &&
      !availability.periodicAutoFramesAvailable &&
      !availability.broadcastUploadLinked
    );
  }
  if (availability.capability === 'manual_screenshot_ocr') {
    return (
      availability.manualFrameAvailable &&
      !availability.periodicAutoFramesAvailable &&
      !availability.broadcastUploadLinked
    );
  }
  return (
    availability.broadcastUploadLinked &&
    availability.periodicAutoFramesAvailable
  );
}
