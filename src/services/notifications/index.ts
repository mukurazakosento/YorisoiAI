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
  /** Web: default = まだ聞いていない / denied / granted / unsupported */
  webPermission?: 'default' | 'granted' | 'denied' | 'unsupported';
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
 * Web の現在の通知状態のみ返す（requestPermission はしない）。
 */
export function getWebNotificationStatus(): SessionNotificationPermission {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return {
      granted: false,
      canUseOsNotifications: false,
      webPermission: 'unsupported',
      detail: 'このブラウザは通知に未対応のため、画面の文字で案内します。',
    };
  }

  const permission = Notification.permission;
  if (permission === 'granted') {
    return {
      granted: true,
      canUseOsNotifications: true,
      webPermission: 'granted',
      detail: 'ブラウザ通知を使って案内します（背面のOCRやAIは動きません）。',
    };
  }
  if (permission === 'denied') {
    return {
      granted: false,
      canUseOsNotifications: false,
      webPermission: 'denied',
      detail: '通知が拒否されているため、画面の文字だけで案内します。',
    };
  }
  return {
    granted: false,
    canUseOsNotifications: false,
    webPermission: 'default',
    detail: '通知が必要なら「通知を許可」を押してください。拒否しても画面の文字は読めます。',
  };
}

/**
 * 利用者開始の明示ボタンから呼ぶ。自動では呼ばない。
 */
export async function requestWebNotificationPermission(): Promise<SessionNotificationPermission> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return getWebNotificationStatus();
  }

  try {
    const current = Notification.permission;
    if (current === 'granted' || current === 'denied') {
      return getWebNotificationStatus();
    }
    await Notification.requestPermission();
    return getWebNotificationStatus();
  } catch {
    return {
      granted: false,
      canUseOsNotifications: false,
      webPermission: 'unsupported',
      detail: '通知を準備できなかったため、画面の文字で案内します。',
    };
  }
}

/**
 * ローカル通知の許可を取る／状態を返す。
 * Web では自動 request せず、現状のみ返す（明示ボタン経由で request）。
 */
export async function ensureNotificationPermission(): Promise<SessionNotificationPermission> {
  configureNotificationHandler();

  if (Platform.OS === 'web') {
    return getWebNotificationStatus();
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

function showWebNotification(body: string): { ok: boolean; reason?: string } {
  const status = getWebNotificationStatus();
  if (!status.canUseOsNotifications) {
    return { ok: false, reason: status.detail };
  }
  try {
    const notification = new Notification('よりそいAI', { body });
    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        // no-op
      }
      // 支援画面へ戻す: すでに前面タブならフォーカスのみ（背面OCRはしない）
      try {
        notification.close();
      } catch {
        // no-op
      }
    };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'web_notification_failed' };
  }
}

/**
 * いまの一手を短い文言でローカル通知する。
 * 失敗しても呼び出し側は画面表示を続けること。
 * Web では許可済みのときだけ。背面OCR／AIを暗示しない。
 */
export async function presentInstructionNotification(
  displayText: string,
): Promise<{ ok: boolean; reason?: string }> {
  const text = displayText.trim();
  if (!text) {
    return { ok: false, reason: 'empty' };
  }

  if (Platform.OS === 'web') {
    return showWebNotification(text);
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
 * ネイティブ: タップで EndSupport。Web: クリックでウィンドウフォーカス（画面内ボタンも併用）。
 */
export async function presentEndSupportNotification(): Promise<{
  ok: boolean;
  reason?: string;
}> {
  if (Platform.OS === 'web') {
    return showWebNotification(END_SUPPORT_DISPLAY);
  }

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
 * 終了通知タップを購読。
 * Web では Expo の response listener を使わない（ネイティブ専用）。
 * Web 通知クリックは showWebNotification の onclick でフォーカスのみ。
 */
export function addEndSupportResponseListener(
  onEndSupport: () => void,
): () => void {
  if (Platform.OS === 'web') {
    return () => {
      // no-op: Web は Expo NotificationResponse を購読しない
    };
  }

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
  if (Platform.OS === 'web') {
    return;
  }
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // no-op
  }
}
