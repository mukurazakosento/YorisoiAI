import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
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
import {
  clarifyChoicesBanner,
  generateClarifyChoices,
} from '../services/onDeviceAi';
import type { ConsultationChoice } from '../types/consultation';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'AiChoice'>;

/**
 * 要求が不明なときの選択肢だけの画面（スクロールなし・約4つ）。
 * 端末内 AI が ready なら動的生成。未接続時はデモ選択肢＋明示ラベル。
 */
export function AiChoiceScreen({ navigation, route }: Props) {
  const { featureId, text, choiceLabel, clarifyRound } = route.params;
  const feature = getFeatureById(featureId);
  const { fontSize } = useSettings();
  const [choices, setChoices] = useState<ConsultationChoice[]>(
    () => DEMO_CLARIFY_CHOICES[featureId].slice(0, 4),
  );
  const [question, setQuestion] = useState(
    'もう少し具体的に教えてください。下のどれかに近いですか？',
  );
  const [banner, setBanner] = useState(() => clarifyChoicesBanner('demo'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const result = await generateClarifyChoices({
        featureId,
        text,
        choiceLabel,
        clarifyRound,
      });
      if (cancelled) {
        return;
      }
      setChoices(result.choices.slice(0, 4));
      setQuestion(result.question);
      setBanner(clarifyChoicesBanner(result.mode));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [featureId, text, choiceLabel, clarifyRound]);

  const pick = (pickedLabel: string) => {
    if (pickedLabel.includes('別の言い方')) {
      navigation.navigate('Consultation', {
        featureId,
        presetText: text,
      });
      return;
    }

    navigation.navigate('SupportSession', {
      featureId,
      summary: pickedLabel,
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
          {banner}
        </Text>
        <Text
          style={[styles.bannerBody, { fontSize: fontSize(baseFontSizes.body) }]}
          numberOfLines={3}
        >
          {loading ? '選択肢を用意しています…' : question}
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
        確認 {clarifyRound} 回目
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
