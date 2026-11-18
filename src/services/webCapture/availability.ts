import type { WebCaptureAvailability, WebCaptureSupport } from './types';

/**
 * getDisplayMedia が使えるか（HTTPS / localhost 等の secure context が必要）。
 * Node スモークや非対応ブラウザでは unsupported を正直に返す。
 */
export function probeWebCaptureSupport(): WebCaptureSupport {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'unsupported';
  }
  if (!window.isSecureContext) {
    return 'secure-context-required';
  }
  const media = navigator.mediaDevices;
  if (!media || typeof media.getDisplayMedia !== 'function') {
    return 'unsupported';
  }
  return 'available';
}

export function getWebCaptureAvailability(): WebCaptureAvailability {
  const support = probeWebCaptureSupport();

  if (support === 'available') {
    return {
      supported: true,
      support,
      canStartShare: true,
      recordingLabel: '画面共有：利用可（利用者開始）',
      ocrLabel: 'OCR：Tesseract.js（ブラウザ内）',
      message:
        '「画面共有を開始」を押すと、約5秒ごとに画面の文字を端末（ブラウザ）内だけで読みます。画像は送りません。',
    };
  }

  if (support === 'secure-context-required') {
    return {
      supported: false,
      support,
      canStartShare: false,
      recordingLabel: '画面共有：不可（要HTTPS）',
      ocrLabel: 'OCR：待機',
      message:
        '画面共有は HTTPS（または localhost）でのみ使えます。安全でない接続では利用できません。',
    };
  }

  return {
    supported: false,
    support,
    canStartShare: false,
    recordingLabel: '画面共有：不可（未対応ブラウザ）',
    ocrLabel: 'OCR：不可',
    message:
      'このブラウザは画面共有（getDisplayMedia）に対応していません。Chrome / Edge / Firefox などの対応ブラウザで開いてください。',
  };
}
