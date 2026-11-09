import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/colors';
import { layout } from '../constants/layout';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';
import type { AiResponse } from '../types/ai';
import { PrimaryButton } from './PrimaryButton';
import { SpeechControls } from './SpeechControls';

type GuidanceStepPanelProps = {
  response: AiResponse;
  busy?: boolean;
  onDone: () => void;
  onSimplify: () => void;
  onExit: () => void;
};

/**
 * 操作支援の1ステップ案内 UI。
 * 画面には短い displayText のみ。音声用 voiceText は別管理（SpeechControls）。
 */
export function GuidanceStepPanel({
  response,
  busy = false,
  onDone,
  onSimplify,
  onExit,
}: GuidanceStepPanelProps) {
  const { fontSize } = useSettings();
  const currentStep = response.currentStep ?? 1;
  const totalSteps = response.totalSteps ?? currentStep;
  const isDemo = response.mode === 'demo' || response.mode === 'offline';

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      {isDemo ? (
        <Text
          style={[styles.modeLabel, { fontSize: fontSize(baseFontSizes.caption) }]}
        >
          {response.mode === 'demo' ? 'デモ案内' : 'AI未接続'}
        </Text>
      ) : null}

      <Text
        style={[styles.stepLabel, { fontSize: fontSize(baseFontSizes.caption) }]}
      >
        {`いまの手順 ${currentStep} / ${totalSteps}`}
      </Text>

      <Text
        style={[styles.displayText, { fontSize: fontSize(baseFontSizes.title) }]}
        accessibilityRole="header"
      >
        {response.displayText}
      </Text>

      {response.message ? (
        <Text
          style={[styles.message, { fontSize: fontSize(baseFontSizes.body) }]}
        >
          {response.message}
        </Text>
      ) : null}

      {response.question ? (
        <Text
          style={[styles.question, { fontSize: fontSize(baseFontSizes.body) }]}
        >
          {response.question}
        </Text>
      ) : null}

      <Text
        style={[styles.hint, { fontSize: fontSize(baseFontSizes.caption) }]}
      >
        操作が終わったら下のボタンを押してください。一度に一つの操作だけ進めます。
      </Text>

      <SpeechControls
        voiceText={response.voiceText}
        displayFallback={response.displayText}
        disabled={busy}
      />

      <View style={styles.buttons}>
        <PrimaryButton
          label={busy ? '考えています…' : 'できました'}
          onPress={onDone}
          disabled={busy}
        />
        <PrimaryButton
          label="分かりません"
          variant="secondary"
          onPress={onSimplify}
          disabled={busy}
        />
        <PrimaryButton
          label="案内をやめる"
          variant="secondary"
          onPress={onExit}
          disabled={busy}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: layout.borderRadius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 14,
  },
  modeLabel: {
    color: colors.primary,
    fontWeight: '700',
  },
  stepLabel: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  displayText: {
    color: colors.text,
    fontWeight: '700',
    lineHeight: 36,
  },
  message: {
    color: colors.textSecondary,
    lineHeight: 28,
  },
  question: {
    color: colors.text,
    lineHeight: 28,
  },
  hint: {
    color: colors.textMuted,
    lineHeight: 26,
  },
  buttons: {
    gap: 12,
    marginTop: 4,
  },
});
