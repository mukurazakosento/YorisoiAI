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

type Props = NativeStackScreenProps<RootStackParamList, 'EndSupport'>;

/**
 * 支援終了後: 解決した / 解決しなかった。
 * 解決しなかった → 同じ機能で再相談。
 */
export function EndSupportScreen({ navigation, route }: Props) {
  const { featureId, summary } = route.params;
  const feature = getFeatureById(featureId);
  const { fontSize } = useSettings();

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="支援の確認" showBack={false} />

      <View style={styles.main}>
        <Text
          style={[styles.lead, { fontSize: fontSize(baseFontSizes.bodyLarge) }]}
          numberOfLines={2}
        >
          問題は解決しましたか？
        </Text>
        <Text
          style={[styles.summary, { fontSize: fontSize(baseFontSizes.body) }]}
          numberOfLines={3}
        >
          {feature.title}：{summary}
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="解決した"
          onPress={() => navigation.popToTop()}
        />
        <PrimaryButton
          label="解決しなかった"
          variant="secondary"
          onPress={() =>
            navigation.navigate('Consultation', {
              featureId,
              presetText: summary,
            })
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
  },
  main: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  lead: {
    color: colors.text,
    fontWeight: '700',
    lineHeight: 32,
    textAlign: 'center',
  },
  summary: {
    color: colors.textSecondary,
    lineHeight: 28,
    textAlign: 'center',
  },
  actions: {
    gap: 12,
    paddingBottom: 8,
  },
});
