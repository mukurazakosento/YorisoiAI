/**
 * 安全性チェック用の画面文字ワンショット取得。
 * AccessibilityService を優先し、取れなければ呼び出し側が OCR へ倒す。
 * 常時監視・自動発信・自動メール送信はしない。
 */

import type { SafetyInspectMode } from '../security';

export type SafetyScreenTextResult = {
  text: string;
  source: 'accessibility' | 'none' | 'empty' | string;
  detail: string;
  armed: boolean;
};

function loadAssistNative(): typeof import('yorisoi-android-assist') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('yorisoi-android-assist') as typeof import('yorisoi-android-assist');
  } catch {
    return null;
  }
}

/** 電話／メール選択後にアーム（無関係画面の常時読み取りはしない）。 */
export function armSafetyScreenRead(mode: SafetyInspectMode): boolean {
  const native = loadAssistNative();
  if (!native?.armSafetyScreenRead) {
    return false;
  }
  try {
    return native.armSafetyScreenRead(mode);
  } catch {
    return false;
  }
}

export function disarmSafetyScreenRead(): void {
  const native = loadAssistNative();
  if (!native?.disarmSafetyScreenRead) {
    return;
  }
  try {
    native.disarmSafetyScreenRead();
  } catch {
    // no-op
  }
}

/**
 * アーム済みのときだけアクティブウィンドウ文字を一度読む。
 */
export function peekSafetyScreenText(): SafetyScreenTextResult {
  const native = loadAssistNative();
  if (!native?.peekSafetyScreenText) {
    return {
      text: '',
      source: 'none',
      detail:
        'AccessibilityService が使えないため、スクショから文字を読み取ってください。',
      armed: false,
    };
  }
  try {
    const armed = Boolean(native.isSafetyScreenReadArmed?.());
    const peeked = native.peekSafetyScreenText();
    return {
      text: (peeked.text ?? '').trim(),
      source: peeked.source ?? 'none',
      detail: peeked.detail ?? '',
      armed,
    };
  } catch {
    return {
      text: '',
      source: 'none',
      detail: '画面の文字を読めませんでした。',
      armed: false,
    };
  }
}
