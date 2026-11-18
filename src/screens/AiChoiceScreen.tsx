import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { ChoiceButton } from '../components/ChoiceButton';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { TextInputField } from '../components/TextInputField';
import { colors } from '../constants/colors';
import { getFeatureById } from '../constants/features';
import { baseFontSizes } from '../constants/typography';
import { DEMO_CLARIFY_CHOICES } from '../data/demoClarifyChoices';
import { useSettings } from '../hooks/useSettings';
import {
  clarifyChoicesBanner,
  classifyIntent,
  generateClarifyChoices,
} from '../services/onDeviceAi';
import type { ClarifyHistoryEntry, ConsultationChoice } from '../types/consultation';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'AiChoice'>;

function buildSummary(
  text: string,
  choiceLabel: string | undefined,
  history: ClarifyHistoryEntry[],
): string {
  const parts = [
    text.trim(),
    choiceLabel?.trim(),
    ...history.map((entry) => entry.answer.trim()).filter(Boolean),
  ].filter(Boolean);
  return parts.join(' / ') || '相談内容';
}

/**
 * アキネーター式の確認画面（1問ずつ・約4択＋自由記述・履歴保持）。
 * 意図が明確になるまで繰り返し、支援セッションへは明確化後のみ進む。
 */
export function AiChoiceScreen({ navigation, route }: Props) {
  const {
    featureId,
    text,
    choiceLabel,
    clarifyRound,
    clarifyHistory = [],
  } = route.params;
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
  const [freeText, setFreeText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const result = await generateClarifyChoices({
        featureId,
        text,
        choiceLabel,
        clarifyRound,
        history: clarifyHistory,
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
  }, [featureId, text, choiceLabel, clarifyRound, clarifyHistory]);

  const advance = async (answer: string) => {
    const trimmed = answer.trim();
    if (!trimmed || busy || loading) {
      return;
    }
    setBusy(true);
    try {
      if (trimmed.includes('別の言い方')) {
        navigation.navigate('Consultation', {
          featureId,
          presetText: text,
        });
        return;
      }

      const nextHistory: ClarifyHistoryEntry[] = [
        ...clarifyHistory,
        { question, answer: trimmed },
      ];
      const intent = await classifyIntent({
        featureId,
        text,
        choiceLabel: trimmed,
        history: nextHistory,
      });

      if (intent.clarity === 'unclear') {
        navigation.replace('AiChoice', {
          featureId,
          text,
          choiceLabel: trimmed,
          clarifyRound: clarifyRound + 1,
          clarifyHistory: nextHistory,
        });
        return;
      }

      navigation.navigate('SupportSession', {
        featureId,
        summary: buildSummary(text, choiceLabel, nextHistory),
      });
    } finally {
      setBusy(false);
    }
  };

  const historyHint =
    clarifyHistory.length > 0
      ? `これまでの確認 ${clarifyHistory.length} 件`
      : '確認を始めます';

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
        <Text
          style={[styles.historyHint, { fontSize: fontSize(baseFontSizes.caption) }]}
          numberOfLines={1}
        >
          {historyHint}・{clarifyRound} 回目
        </Text>
      </View>

      <View style={styles.choices}>
        {choices.map((choice) => (
          <ChoiceButton
            key={choice.id}
            label={choice.label}
            compact
            onPress={() => {
              void advance(choice.label);
            }}
          />
        ))}
      </View>

      <TextInputField
        label="自分の言葉で答える"
        value={freeText}
        onChangeText={setFreeText}
        placeholder="例：通知がこない"
        compact
      />

      <PrimaryButton
        label={busy ? '確認しています…' : 'この答えで進む'}
        onPress={() => {
          void advance(freeText);
        }}
        disabled={busy || loading || freeText.trim().length === 0}
      />

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
    gap: 8,
  },
  banner: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 4,
  },
  bannerLabel: {
    color: colors.primary,
    fontWeight: '700',
  },
  bannerBody: {
    color: colors.text,
    lineHeight: 26,
  },
  historyHint: {
    color: colors.textMuted,
  },
  choices: {
    flex: 1,
    gap: 6,
    minHeight: 0,
  },
});
