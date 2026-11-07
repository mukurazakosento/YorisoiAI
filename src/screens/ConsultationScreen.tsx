import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { ChoiceButton } from '../components/ChoiceButton';
import { InfoCard } from '../components/InfoCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { TextInputField } from '../components/TextInputField';
import { colors } from '../constants/colors';
import { getFeatureById } from '../constants/features';
import { baseFontSizes } from '../constants/typography';
import { INITIAL_CHOICES } from '../data/initialChoices';
import { useSettings } from '../hooks/useSettings';
import { requestConsultation } from '../services/ai';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Consultation'>;

export function ConsultationScreen({ navigation, route }: Props) {
  const { featureId } = route.params;
  const feature = getFeatureById(featureId);
  const choices = useMemo(() => INITIAL_CHOICES[featureId], [featureId]);
  const { fontSize } = useSettings();

  const [inputText, setInputText] = useState('');
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canStart = inputText.trim().length > 0 || selectedChoiceId !== null;

  const handleStart = async () => {
    if (!canStart || busy) {
      return;
    }

    const choiceLabel = choices.find((c) => c.id === selectedChoiceId)?.label;
    setBusy(true);
    try {
      const response = await requestConsultation({
        featureId,
        text: inputText.trim(),
        choiceLabel,
      });
      setStatusMessage(
        response.message ??
          'いまは相談の受け付け準備だけができます。AIにつながるまでお待ちください。',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppHeader
        title={feature.title}
        showBack
        onPressBack={() => navigation.goBack()}
      />

      <Text style={[styles.lead, { fontSize: fontSize(baseFontSizes.body) }]}>
        文章を書くか、下の選択肢を押してください。
      </Text>

      <InfoCard message="AI相談はまだつながっていません。入力と選択肢の確認ができます。" />

      <TextInputField
        label="困っていること"
        value={inputText}
        onChangeText={setInputText}
        placeholder="例：LINEの通知が来ない"
      />

      <View style={styles.choicesHeader}>
        <Text
          style={[styles.sectionTitle, { fontSize: fontSize(baseFontSizes.bodyLarge) }]}
        >
          よくある相談
        </Text>
        <Text
          style={[styles.sectionHint, { fontSize: fontSize(baseFontSizes.caption) }]}
        >
          あとから、内容に合わせて選択肢が変わります。
        </Text>
      </View>

      <View style={styles.choices}>
        {choices.map((choice) => (
          <ChoiceButton
            key={choice.id}
            label={choice.label}
            selected={selectedChoiceId === choice.id}
            onPress={() => setSelectedChoiceId(choice.id)}
          />
        ))}
      </View>

      <PrimaryButton
        label={busy ? '確認しています…' : 'この内容で進む'}
        onPress={() => {
          void handleStart();
        }}
        disabled={!canStart || busy}
      />

      {statusMessage ? (
        <View style={styles.result}>
          <Text
            style={[styles.resultText, { fontSize: fontSize(baseFontSizes.body) }]}
          >
            {statusMessage}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: {
    color: colors.textSecondary,
    lineHeight: 28,
  },
  choicesHeader: {
    gap: 6,
    marginTop: 4,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '700',
  },
  sectionHint: {
    color: colors.textMuted,
    lineHeight: 26,
  },
  choices: {
    gap: 12,
  },
  result: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  resultText: {
    color: colors.text,
    lineHeight: 28,
  },
});
