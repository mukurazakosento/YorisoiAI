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
import {
  getAiConnectionBanner,
  requestConsultation,
  type ConsultHistoryTurn,
} from '../services/ai';
import type { AiResponse } from '../types/ai';
import type { ConsultationChoice } from '../types/consultation';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Consultation'>;

function toChoiceItems(labels: string[]): ConsultationChoice[] {
  return labels.map((label, index) => ({
    id: `dynamic-${index}-${label}`,
    label,
  }));
}

export function ConsultationScreen({ navigation, route }: Props) {
  const { featureId } = route.params;
  const feature = getFeatureById(featureId);
  const initialChoices = useMemo(() => INITIAL_CHOICES[featureId], [featureId]);
  const connection = useMemo(() => getAiConnectionBanner(), []);
  const { fontSize } = useSettings();

  const [inputText, setInputText] = useState('');
  const [choices, setChoices] = useState<ConsultationChoice[]>(initialChoices);
  const [choicesAreDynamic, setChoicesAreDynamic] = useState(false);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<AiResponse | null>(null);
  const [history, setHistory] = useState<ConsultHistoryTurn[]>([]);
  const [busy, setBusy] = useState(false);

  const canStart = inputText.trim().length > 0 || selectedChoiceId !== null;

  const handleStart = async () => {
    if (!canStart || busy) {
      return;
    }

    const choiceLabel = choices.find((c) => c.id === selectedChoiceId)?.label;
    if (
      choiceLabel === '最初の選択肢に戻る' ||
      choiceLabel === '別のことで相談する'
    ) {
      handleResetChoices();
      return;
    }

    const userText = inputText.trim();
    const userSummary = [choiceLabel, userText].filter(Boolean).join(' / ');

    setBusy(true);
    try {
      const response = await requestConsultation({
        featureId,
        text: userText,
        choiceLabel,
        history,
      });

      setLastResponse(response);
      setHistory((prev) => [
        ...prev,
        { role: 'user', text: userSummary || userText || choiceLabel || '' },
        {
          role: 'assistant',
          text:
            response.message ??
            response.displayText ??
            response.question ??
            '',
        },
      ]);

      if (response.choices && response.choices.length > 0) {
        setChoices(toChoiceItems(response.choices));
        setChoicesAreDynamic(true);
        setSelectedChoiceId(null);
        setInputText('');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResetChoices = () => {
    setChoices(initialChoices);
    setChoicesAreDynamic(false);
    setSelectedChoiceId(null);
    setLastResponse(null);
    setHistory([]);
    setInputText('');
  };

  const resultBody = buildResultBody(lastResponse);

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

      <InfoCard message={connection.message} />

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
          {choicesAreDynamic ? 'おすすめの選択肢' : 'よくある相談'}
        </Text>
        <Text
          style={[styles.sectionHint, { fontSize: fontSize(baseFontSizes.caption) }]}
        >
          {choicesAreDynamic
            ? '内容に合わせて選択肢が変わりました。'
            : connection.connected
              ? '相談を送ると、内容に合わせて選択肢が変わります。'
              : 'AI未接続のため、基本の選択肢を表示しています。'}
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
        label={busy ? '考えています…' : 'この内容で進む'}
        onPress={() => {
          void handleStart();
        }}
        disabled={!canStart || busy}
      />

      {choicesAreDynamic ? (
        <PrimaryButton
          label="最初の選択肢に戻る"
          variant="secondary"
          onPress={handleResetChoices}
          disabled={busy}
        />
      ) : null}

      {resultBody ? (
        <View style={styles.result}>
          {lastResponse?.mode === 'demo' || lastResponse?.mode === 'offline' ? (
            <Text
              style={[
                styles.modeLabel,
                { fontSize: fontSize(baseFontSizes.caption) },
              ]}
            >
              {lastResponse.mode === 'demo' ? 'デモ案内' : 'AI未接続'}
            </Text>
          ) : null}
          <Text
            style={[styles.resultText, { fontSize: fontSize(baseFontSizes.body) }]}
          >
            {resultBody}
          </Text>
          {lastResponse?.recommendedActions &&
          lastResponse.recommendedActions.length > 0 ? (
            <View style={styles.actions}>
              {lastResponse.recommendedActions.map((action) => (
                <Text
                  key={action}
                  style={[
                    styles.actionItem,
                    { fontSize: fontSize(baseFontSizes.body) },
                  ]}
                >
                  ・{action}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function buildResultBody(response: AiResponse | null): string | null {
  if (!response) {
    return null;
  }

  const parts = [
    response.displayText,
    response.message,
    response.question,
    response.voiceText ? `（音声用）${response.voiceText}` : undefined,
  ].filter((part): part is string => Boolean(part && part.trim()));

  if (parts.length === 0) {
    return '返事を表示できませんでした。もう一度お試しください。';
  }

  // 重複を避けつつ読み順を保つ
  const unique: string[] = [];
  for (const part of parts) {
    if (!unique.includes(part)) {
      unique.push(part);
    }
  }
  return unique.join('\n\n');
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
    gap: 10,
  },
  modeLabel: {
    color: colors.primary,
    fontWeight: '700',
  },
  resultText: {
    color: colors.text,
    lineHeight: 28,
  },
  actions: {
    gap: 6,
  },
  actionItem: {
    color: colors.textSecondary,
    lineHeight: 28,
  },
});
