import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { colors } from '../constants/colors';
import { getFeatureById } from '../constants/features';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'SupportSession'>;

type StubRowProps = {
  title: string;
  detail: string;
  fontSize: (n: number) => number;
};

function StubRow({ title, detail, fontSize }: StubRowProps) {
  return (
    <View style={styles.stubRow}>
      <View style={styles.stubHeader}>
        <Text
          style={[styles.stubTitle, { fontSize: fontSize(baseFontSizes.bodyLarge) }]}
        >
          {title}
        </Text>
        <Text
          style={[styles.stubBadge, { fontSize: fontSize(baseFontSizes.caption) }]}
        >
          準備中
        </Text>
      </View>
      <Text
        style={[styles.stubDetail, { fontSize: fontSize(baseFontSizes.caption) }]}
        numberOfLines={2}
      >
        {detail}
      </Text>
    </View>
  );
}

/**
 * 支援セッションのシェル。録画・定期OCR・通知は未実装のため準備中と明示。
 * 「通知で終了」の概念だけスタブで再現する。
 */
export function SupportSessionScreen({ navigation, route }: Props) {
  const { featureId, summary } = route.params;
  const feature = getFeatureById(featureId);
  const { fontSize } = useSettings();

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        title="支援セッション"
        showBack
        onPressBack={() => navigation.goBack()}
      />

      <Text
        style={[styles.featureLabel, { fontSize: fontSize(baseFontSizes.caption) }]}
      >
        {feature.title}
      </Text>
      <Text
        style={[styles.summary, { fontSize: fontSize(baseFontSizes.body) }]}
        numberOfLines={2}
      >
        {summary}
      </Text>

      <View style={styles.stubs}>
        <StubRow
          title="画面収録"
          detail="他アプリ画面の録画は未実装。iOSでは常時監視に強い制限があります。"
          fontSize={fontSize}
        />
        <StubRow
          title="定期OCR"
          detail="収録フレームからの端末内文字認識は未実装です。"
          fontSize={fontSize}
        />
        <StubRow
          title="通知と音声"
          detail="指示の通知・読み上げ配線は後続フェーズです。"
          fontSize={fontSize}
        />
      </View>

      <View style={styles.notifyConcept}>
        <Text
          style={[
            styles.notifyLabel,
            { fontSize: fontSize(baseFontSizes.caption) },
          ]}
        >
          通知のイメージ（動作していません）
        </Text>
        <Text
          style={[styles.notifyBody, { fontSize: fontSize(baseFontSizes.body) }]}
          numberOfLines={2}
        >
          「ここをタップで支援を終了」
        </Text>
      </View>

      <PrimaryButton
        label="支援を終了する"
        onPress={() =>
          navigation.navigate('EndSupport', {
            featureId,
            summary,
          })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 10,
  },
  featureLabel: {
    color: colors.primary,
    fontWeight: '700',
  },
  summary: {
    color: colors.text,
    lineHeight: 26,
    fontWeight: '600',
  },
  stubs: {
    flex: 1,
    gap: 8,
    minHeight: 0,
  },
  stubRow: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    gap: 4,
  },
  stubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stubTitle: {
    color: colors.text,
    fontWeight: '700',
    flex: 1,
  },
  stubBadge: {
    color: colors.warning,
    fontWeight: '700',
  },
  stubDetail: {
    color: colors.textMuted,
    lineHeight: 22,
  },
  notifyConcept: {
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    backgroundColor: colors.surface,
  },
  notifyLabel: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  notifyBody: {
    color: colors.textSecondary,
    lineHeight: 26,
  },
});
