import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { ChoiceButton } from '../components/ChoiceButton';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { TextInputField } from '../components/TextInputField';
import { colors } from '../constants/colors';
import { getFeatureById } from '../constants/features';
import { baseFontSizes } from '../constants/typography';
import { INITIAL_CHOICES } from '../data/initialChoices';
import { useSettings } from '../hooks/useSettings';
import { classifyIntentStub } from '../services/session';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Consultation'>;

/**
 * 相談開始画面: 入力欄 + 約4選択肢をスクロールなしで同時表示。
 * 意図が明確なら支援セッションへ、不明なら AI 選択肢画面へ。
 */
export function ConsultationScreen({ navigation, route }: Props) {
  const { featureId, presetText } = route.params;
  const feature = getFeatureById(featureId);
  const choices = useMemo(() => INITIAL_CHOICES[featureId].slice(0, 4), [featureId]);
  const { fontSize } = useSettings();
  const [inputText, setInputText] = useState(presetText ?? '');

  const inputLabel =
    featureId === 'textExplanation'
      ? '説明したい文章'
      : featureId === 'safetyCheck'
        ? '確認したいこと'
        : '困っていること';

  const inputPlaceholder =
    featureId === 'textExplanation'
      ? '例：写真へのアクセスを許可しますか？'
      : featureId === 'safetyCheck'
        ? '例：知らない番号から電話があった'
        : '例：LINEの通知が来ない';

  const proceed = (text: string, choiceLabel?: string) => {
    const clarity = classifyIntentStub({ featureId, text, choiceLabel });
    const summary = [choiceLabel, text].filter(Boolean).join(' / ');

    if (clarity === 'unclear') {
      navigation.navigate('AiChoice', {
        featureId,
        text,
        choiceLabel,
        clarifyRound: 1,
      });
      return;
    }

    navigation.navigate('SupportSession', {
      featureId,
      summary: summary || feature.title,
    });
  };

  const canSubmit = inputText.trim().length > 0;

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        title={feature.title}
        showBack
        onPressBack={() => navigation.goBack()}
      />

      <Text
        style={[styles.lead, { fontSize: fontSize(baseFontSizes.body) }]}
        numberOfLines={2}
      >
        文章を書くか、下のどれかを押してください。
      </Text>

      <TextInputField
        label={inputLabel}
        value={inputText}
        onChangeText={setInputText}
        placeholder={inputPlaceholder}
        compact
      />

      <View style={styles.choicesBlock}>
        <Text
          style={[
            styles.sectionTitle,
            { fontSize: fontSize(baseFontSizes.bodyLarge) },
          ]}
        >
          よくある相談
        </Text>
        <View style={styles.choices}>
          {choices.map((choice) => (
            <ChoiceButton
              key={choice.id}
              label={choice.label}
              compact
              onPress={() => proceed(inputText.trim(), choice.label)}
            />
          ))}
        </View>
      </View>

      <PrimaryButton
        label="この内容で進む"
        onPress={() => proceed(inputText.trim())}
        disabled={!canSubmit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 10,
  },
  lead: {
    color: colors.textSecondary,
    lineHeight: 26,
  },
  choicesBlock: {
    flex: 1,
    gap: 8,
    minHeight: 0,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '700',
  },
  choices: {
    flex: 1,
    gap: 8,
    minHeight: 0,
  },
});
