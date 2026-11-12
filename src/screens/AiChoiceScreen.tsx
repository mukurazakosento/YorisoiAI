import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { ChoiceButton } from '../components/ChoiceButton';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { colors } from '../constants/colors';
import { getFeatureById } from '../constants/features';
import { baseFontSizes } from '../constants/typography';
import { DEMO_CLARIFY_CHOICES } from '../data/demoClarifyChoices';
import { useSettings } from '../hooks/useSettings';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'AiChoice'>;

/**
 * 要求が不明なときの選択肢だけの画面（スクロールなし・約4つ）。
 * 端末内 Llama 未接続のためデモ選択肢＋明示ラベル。
 */
export function AiChoiceScreen({ navigation, route }: Props) {
  const { featureId, text, clarifyRound } = route.params;
  const feature = getFeatureById(featureId);
  const { fontSize } = useSettings();
  const choices = DEMO_CLARIFY_CHOICES[featureId].slice(0, 4);

  const pick = (choiceLabel: string) => {
    if (choiceLabel.includes('別の言い方')) {
      navigation.navigate('Consultation', {
        featureId,
        presetText: text,
      });
      return;
    }

    // デモでは1回の具体化で支援セッションへ進む（本物の AI ループは後続）
    navigation.navigate('SupportSession', {
      featureId,
      summary: choiceLabel,
    });
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        title={feature.title}
        showBack
        onPressBack={() => navigation.goBack()}
      />

      <View style={styles.banner}>
        <Text
          style={[styles.bannerLabel, { fontSize: fontSize(baseFontSizes.caption) }]}
        >
          デモ選択肢（端末内AIは未接続）
        </Text>
        <Text
          style={[styles.bannerBody, { fontSize: fontSize(baseFontSizes.body) }]}
          numberOfLines={3}
        >
          もう少し具体的に教えてください。下のどれかに近いですか？
        </Text>
      </View>

      <View style={styles.choices}>
        {choices.map((choice) => (
          <ChoiceButton
            key={choice.id}
            label={choice.label}
            compact
            onPress={() => pick(choice.label)}
          />
        ))}
      </View>

      <Text
        style={[styles.roundHint, { fontSize: fontSize(baseFontSizes.caption) }]}
      >
        確認 {clarifyRound} 回目（シェル）
      </Text>

      <PrimaryButton
        label="相談の最初に戻る"
        variant="secondary"
        onPress={() => navigation.navigate('Consultation', { featureId })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 10,
  },
  banner: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6,
  },
  bannerLabel: {
    color: colors.primary,
    fontWeight: '700',
  },
  bannerBody: {
    color: colors.text,
    lineHeight: 26,
  },
  choices: {
    flex: 1,
    gap: 8,
    minHeight: 0,
  },
  roundHint: {
    color: colors.textMuted,
    textAlign: 'center',
  },
});
