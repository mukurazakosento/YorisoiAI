import type { NavigationProp } from '@react-navigation/native';

import { getAndroidAssistAvailability } from '../services/androidAssist';
import type { FeatureId, RootStackParamList } from '../types/navigation';

type Nav = NavigationProp<RootStackParamList>;

/**
 * Android で背面支援が使えるときは、中間の画面共有説明を挟まず
 * SupportSession で MediaProjection をすぐ開始する。
 * OS の画面共有許可ダイアログは従来どおり出る。
 * iOS / Web は既存どおり SupportSession（背面支援なし）のみ。
 *
 * 安全性チェックも電話／メール選択後に背面で検出→通知+TTS
 * （結果のために Activity を前面に戻さない）。
 */
export function navigateToSupportSession(
  navigation: Nav,
  params: { featureId: FeatureId; summary: string },
): void {
  const assist = getAndroidAssistAvailability();
  navigation.navigate('SupportSession', {
    ...params,
    backgroundAssist: assist.available,
  });
}
