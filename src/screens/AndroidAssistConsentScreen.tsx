import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { colors } from '../constants/colors';
import { getFeatureById } from '../constants/features';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';
import { getAndroidAssistAvailability } from '../services/androidAssist';
import { isOnDeviceAiReady } from '../services/onDeviceAi';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'AndroidAssistConsent'>;

/**
 * Android 背面支援の説明・同意。MediaProjection のシステム許可の前に必ず出す。
 * スクロール禁止。拒否時は手動スクショ経路の支援へ。
 */
export function AndroidAssistConsentScreen({ navigation, route }: Props) {
  const { featureId, summary } = route.params;
  const feature = getFeatureById(featureId);
  const { fontSize } = useSettings();
  const assist = getAndroidAssistAvailability();
  const aiDemo = !isOnDeviceAiReady();

  const goWithAssist = () => {
    navigation.replace('SupportSession', {
      featureId,
      summary,
      backgroundAssist: true,
    });
  };

  const goManualOnly = () => {
    navigation.replace('SupportSession', {
      featureId,
      summary,
      backgroundAssist: false,
    });
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        title={feature.title}
        showBack
        onPressBack={() => navigation.goBack()}
      />

      <Text
        style={[styles.title, { fontSize: fontSize(baseFontSizes.title) }]}
        numberOfLines={2}
        accessibilityRole="header"
      >
        背面でも案内を続けますか？
      </Text>

      <View style={styles.body}>
        <Text
          style={[styles.line, { fontSize: fontSize(baseFontSizes.body) }]}
          numberOfLines={3}
        >
          次の画面で「画面の共有」を許可すると、よりそいAIを背面にしても約3秒ごとに文字を読み、変わったときだけ案内します。
        </Text>
        <Text
          style={[styles.line, { fontSize: fontSize(baseFontSizes.body) }]}
          numberOfLines={2}
        >
          画像は端末の中だけ・保存しません。代わりにタップや送信はしません。
        </Text>
        <Text
          style={[styles.line, { fontSize: fontSize(baseFontSizes.caption) }]}
          numberOfLines={2}
        >
          {assist.message}
        </Text>
        {aiDemo ? (
          <Text
            style={[styles.demo, { fontSize: fontSize(baseFontSizes.caption) }]}
            numberOfLines={1}
          >
            案内はデモ判定です（端末内AIは未接続）。
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="画面共有して続ける" onPress={goWithAssist} />
        <PrimaryButton
          label="手動の読み取りだけにする"
          variant="secondary"
          onPress={goManualOnly}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
  },
  title: {
    color: colors.text,
    fontWeight: '700',
    lineHeight: 34,
  },
  body: {
    flex: 1,
    minHeight: 0,
    gap: 10,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  line: {
    color: colors.text,
    lineHeight: 26,
  },
  demo: {
    color: colors.warning,
    fontWeight: '700',
  },
  actions: {
    gap: 8,
  },
});
