/**
 * Optional AccessibilityService helpers for system permission dialog text.
 * Lazy-loads the native module so Node smokes do not pull react-native.
 */

type AssistNative = {
  isAndroidDialogAccessibilityEnabled?: () => boolean;
  openAndroidDialogAccessibilitySettings?: () => Promise<void>;
};

function loadNative(): AssistNative | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('yorisoi-android-assist') as AssistNative;
  } catch {
    return null;
  }
}

/** True when the optional dialog AccessibilityService is enabled in system settings. */
export function isAndroidDialogAccessibilityEnabled(): boolean {
  const native = loadNative();
  if (!native?.isAndroidDialogAccessibilityEnabled) {
    return false;
  }
  try {
    return native.isAndroidDialogAccessibilityEnabled();
  } catch {
    return false;
  }
}

/** Opens Android Accessibility settings so the user can enable dialog text reading. */
export async function openAndroidDialogAccessibilitySettings(): Promise<void> {
  const native = loadNative();
  if (!native?.openAndroidDialogAccessibilitySettings) {
    throw new Error(
      'このビルドではシステム許可ダイアログ用の読み取り設定を開けません。',
    );
  }
  await native.openAndroidDialogAccessibilitySettings();
}
