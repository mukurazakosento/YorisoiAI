import type { NavigationProp } from '@react-navigation/native';

import { getAndroidAssistAvailability } from '../services/androidAssist';
import type { FeatureId, RootStackParamList } from '../types/navigation';

type Nav = NavigationProp<RootStackParamList>;

/**
 * Android で背面支援が使えるときは同意画面へ。それ以外は直接 SupportSession。
 * iOS / Web は既存どおり SupportSession のみ。
 *
 * 安全性チェックも MediaProjection 同意へ進める（電話／メール選択後に背面で検出→
 * 通知+TTS。結果のために Activity を前面に戻さない）。
 */
export function navigateToSupportSession(
  navigation: Nav,
  params: { featureId: FeatureId; summary: string },
): void {
  const assist = getAndroidAssistAvailability();
  if (assist.available) {
    navigation.navigate('AndroidAssistConsent', params);
    return;
  }
  navigation.navigate('SupportSession', {
    ...params,
    backgroundAssist: false,
  });
}
