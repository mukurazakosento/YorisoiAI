import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/colors';
import { layout } from '../constants/layout';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';
import type { AiExplanation, AiResponse } from '../types/ai';
import { PrimaryButton } from './PrimaryButton';

type ExplanationResultPanelProps = {
  response: AiResponse;
  onReplay?: () => void;
};

const SECTIONS: {
  key: keyof AiExplanation;
  label: string;
}[] = [
  { key: 'displayedText', label: '表示された文章' },
  { key: 'plainMeaning', label: '簡単に言うと' },
  { key: 'whatHappens', label: '操作すると何が起こるか' },
  { key: 'cautions', label: '注意すること' },
  { key: 'judgmentPoints', label: '判断するためのポイント' },
];

/**
 * 文章解説の5区画表示。長い文章を一度に詰め込まず、見出しごとに区切る。
 */
export function ExplanationResultPanel({
  response,
  onReplay,
}: ExplanationResultPanelProps) {
  const { fontSize } = useSettings();
  const explanation = response.explanation;

  if (!explanation) {
    return null;
  }

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      {response.mode === 'demo' || response.mode === 'offline' ? (
        <Text
          style={[styles.modeLabel, { fontSize: fontSize(baseFontSizes.caption) }]}
        >
          {response.mode === 'demo' ? 'デモ案内' : 'AI未接続'}
        </Text>
      ) : null}

      {response.message ? (
        <Text
          style={[styles.message, { fontSize: fontSize(baseFontSizes.body) }]}
        >
          {response.message}
        </Text>
      ) : null}

      {SECTIONS.map((section) => {
        const body = explanation[section.key]?.trim();
        if (!body) {
          return null;
        }
        return (
          <View key={section.key} style={styles.block}>
            <Text
              style={[
                styles.label,
                { fontSize: fontSize(baseFontSizes.bodyLarge) },
              ]}
            >
              {section.label}
            </Text>
            <Text
              style={[styles.body, { fontSize: fontSize(baseFontSizes.body) }]}
            >
              {body}
            </Text>
          </View>
        );
      })}

      {response.question ? (
        <Text
          style={[styles.question, { fontSize: fontSize(baseFontSizes.body) }]}
        >
          {response.question}
        </Text>
      ) : null}

      {onReplay && (response.voiceText || response.displayText) ? (
        <PrimaryButton
          label="もう一度聞く"
          variant="secondary"
          onPress={onReplay}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: layout.borderRadius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 14,
  },
  modeLabel: {
    color: colors.primary,
    fontWeight: '700',
  },
  message: {
    color: colors.textSecondary,
    lineHeight: 28,
  },
  block: {
    gap: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  label: {
    color: colors.primary,
    fontWeight: '700',
  },
  body: {
    color: colors.text,
    lineHeight: 28,
  },
  question: {
    color: colors.textSecondary,
    lineHeight: 28,
  },
});
