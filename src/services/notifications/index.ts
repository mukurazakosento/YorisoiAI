import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { SessionNotificationKind } from '../../types/session';
import { END_SUPPORT_DISPLAY } from '../session/demoSteps';

export const END_SUPPORT_NOTIFICATION_DATA = {
  kind: 'end_support' as SessionNotificationKind,
};

export const INSTRUCTION_NOTIFICATION_DATA = {
  kind: 'instruction' as SessionNotificationKind,
};

export type SessionNotificationPermission = {
  granted: boolean;
  /** OS が拒否／未対応などで通知できないとき、画面内表示へフォールバック */
  canUseOsNotifications: boolean;
  detail: string;
};

let handlerConfigured = false;
let androidChannelReady = false;

/**
 * フォアグラウンドでもバナー／リストに出す。
 * アプリ起動時に一度呼ぶ。
 */
export function configureNotificationHandler(): void {
  if (handlerConfigured) {
    return;
  }
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android' || androidChannelReady) {
    return;
  }
  await Notifications.setNotificationChannelAsync('yorisoi-guidance', {
    name: 'よりそいAIの案内',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 120],
    lightColor: '#1F6B5C',
  });
  androidChannelReady = true;
}

/**
 * ローカル通知の許可を取る。拒否されても画面内案内は続ける。
 */
export async function ensureNotificationPermission(): Promise<SessionNotificationPermission> {
  configureNotificationHandler();

  if (Platform.OS === 'web') {
    return {
      granted: false,
      canUseOsNotifications: false,
      detail: 'WebではOS通知を使わず、画面の文字で案内します。',
    };
  }

  try {
    await ensureAndroidChannel();
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    const granted = status === 'granted';
    return {
      granted,
      canUseOsNotifications: granted,
      detail: granted
        ? '通知を使って案内します。'
        : '通知が許可されていないため、画面の文字で案内します。',
    };
  } catch {
    return {
      granted: false,
      canUseOsNotifications: false,
      detail: '通知を準備できなかったため、画面の文字で案内します。',
    };
  }
}

/**
 * いまの一手を短い文言でローカル通知する。
 * 失敗しても呼び出し側は画面表示を続けること。
 */
export async function presentInstructionNotification(
  displayText: string,
): Promise<{ ok: boolean; reason?: string }> {
  const text = displayText.trim();
  if (!text) {
    return { ok: false, reason: 'empty' };
  }

  const permission = await ensureNotificationPermission();
  if (!permission.canUseOsNotifications) {
    return { ok: false, reason: permission.detail };
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'よりそいAI',
        body: text,
        data: { ...INSTRUCTION_NOTIFICATION_DATA },
        sound: false,
      },
      trigger: null,
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'schedule_failed' };
  }
}

/**
 * 「ここをタップで支援を終了」通知。
 * タップ時は addEndSupportResponseListener で EndSupport へ。
 */
export async function presentEndSupportNotification(): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const permission = await ensureNotificationPermission();
  if (!permission.canUseOsNotifications) {
    return { ok: false, reason: permission.detail };
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'よりそいAI',
        body: END_SUPPORT_DISPLAY,
        data: { ...END_SUPPORT_NOTIFICATION_DATA },
        sound: false,
      },
      trigger: null,
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'schedule_failed' };
  }
}

export function isEndSupportNotificationData(
  data: unknown,
): data is { kind: 'end_support' } {
  if (!data || typeof data !== 'object') {
    return false;
  }
  return (data as { kind?: string }).kind === 'end_support';
}

/**
 * 終了通知タップを購読。OS が拒否していても画面内ボタンで同等動作。
 */
export function addEndSupportResponseListener(
  onEndSupport: () => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      if (isEndSupportNotificationData(response.notification.request.content.data)) {
        onEndSupport();
      }
    },
  );
  return () => {
    subscription.remove();
  };
}

export async function dismissSessionNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // no-op
  }
}
