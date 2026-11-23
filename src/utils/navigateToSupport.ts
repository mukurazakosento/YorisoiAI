import type { NavigationProp } from '@react-navigation/native';

import { getAndroidAssistAvailability } from '../services/androidAssist';
import type { FeatureId, RootStackParamList } from '../types/navigation';

type Nav = NavigationProp<RootStackParamList>;

/**
 * Android で背面支援が使えるときは同意画面へ。それ以外は直接 SupportSession。
 * iOS / Web は既存どおり SupportSession のみ。
 *
 * 安全性チェックは連続 MediaProjection を既定にしない（電話／メール選択後の
 * ワンショット検出＋手動 OCR を優先。無関係な画面の常時読み取りを避ける）。
 */
export function navigateToSupportSession(
  navigation: Nav,
  params: { featureId: FeatureId; summary: string },
): void {
  if (params.featureId === 'safetyCheck') {
    navigation.navigate('SupportSession', {
      ...params,
      backgroundAssist: false,
    });
    return;
  }

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
