import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/colors';
import { layout } from '../constants/layout';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';
import {
  buildLayoutHints,
  getOcrAvailability,
  pickAndRecognizeScreenshot,
  type OcrResult,
} from '../services/ocr';
import { InfoCard } from './InfoCard';
import { PrimaryButton } from './PrimaryButton';
import { TextInputField } from './TextInputField';

export type ConfirmedOcrPayload = {
  text: string;
  layoutHints: string;
  result: OcrResult;
};

type ScreenshotOcrPanelProps = {
  /** 利用者が確認したテキストだけが渡る。画像は渡らない。 */
  onConfirmed: (payload: ConfirmedOcrPayload) => void;
  onCleared?: () => void;
};

type Phase = 'idle' | 'running' | 'review' | 'confirmed';

/**
 * スクリーンショット選択 → 端末内 OCR → 確認/修正 → 相談へ渡す UI。
 * 画像バイナリは AI / サーバーへ送らない。
 */
export function ScreenshotOcrPanel({
  onConfirmed,
  onCleared,
}: ScreenshotOcrPanelProps) {
  const { fontSize } = useSettings();
  const availability = getOcrAvailability();

  const [phase, setPhase] = useState<Phase>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [confirmedText, setConfirmedText] = useState<string | null>(null);

  const handlePick = async () => {
    if (phase === 'running') {
      return;
    }

    setPhase('running');
    setStatusMessage('写真から画面を選んでいます…');
    setConfirmedText(null);

    const outcome = await pickAndRecognizeScreenshot();

    if (outcome.status === 'canceled') {
      setPhase(confirmedText ? 'confirmed' : 'idle');
      setStatusMessage(null);
      return;
    }

    if (
      outcome.status === 'denied' ||
      outcome.status === 'unavailable' ||
      outcome.status === 'error'
    ) {
      setPhase('idle');
      setStatusMessage(outcome.message);
      return;
    }

    if (outcome.status === 'empty') {
      setOcrResult(outcome.result);
      setDraftText('');
      setPhase('review');
      setStatusMessage(outcome.message);
      return;
    }

    setOcrResult(outcome.result);
    setDraftText(outcome.result.fullText);
    setPhase('review');
    setStatusMessage(
      '読み取った文字です。間違いがあれば直してから「この文字で相談する」を押してください。画像は端末の外へ送っていません。',
    );
  };

  const handleConfirm = () => {
    const text = draftText.trim();
    if (!text || !ocrResult) {
      setStatusMessage(
        '相談に使う文字が空です。必要な部分を残すか、下に自分で書いてください。',
      );
      return;
    }

    const layoutHints = buildLayoutHints(ocrResult);
    setConfirmedText(text);
    setPhase('confirmed');
    setStatusMessage(
      '確認した文字だけを相談に使います。画像そのものは送りません。',
    );
    onConfirmed({ text, layoutHints, result: ocrResult });
  };

  const handleClear = () => {
    setPhase('idle');
    setDraftText('');
    setOcrResult(null);
    setConfirmedText(null);
    setStatusMessage(null);
    onCleared?.();
  };

  return (
    <View style={styles.wrap}>
      <Text
        style={[styles.title, { fontSize: fontSize(baseFontSizes.bodyLarge) }]}
      >
        スクリーンショットから文字を取り込む
      </Text>
      <Text
        style={[styles.hint, { fontSize: fontSize(baseFontSizes.caption) }]}
      >
        {availability.message}
      </Text>

      <PrimaryButton
        label={
          phase === 'running'
            ? '読み取り中…'
            : '写真からスクリーンショットを選ぶ'
        }
        onPress={() => {
          void handlePick();
        }}
        disabled={phase === 'running'}
        variant="secondary"
      />

      {statusMessage ? <InfoCard message={statusMessage} /> : null}

      {phase === 'review' ? (
        <View style={styles.review}>
          <TextInputField
            label="読み取った文字（直してから使います）"
            value={draftText}
            onChangeText={setDraftText}
            placeholder="必要な文字だけ残してください"
          />
          <PrimaryButton
            label="この文字で相談する"
            onPress={handleConfirm}
            disabled={draftText.trim().length === 0}
          />
          <PrimaryButton
            label="読み取りをやめる"
            variant="secondary"
            onPress={handleClear}
          />
        </View>
      ) : null}

      {phase === 'confirmed' && confirmedText ? (
        <View style={styles.confirmed}>
          <Text
            style={[
              styles.confirmedLabel,
              { fontSize: fontSize(baseFontSizes.caption) },
            ]}
          >
            相談に使う文字（確認済み）
          </Text>
          <Text
            style={[
              styles.confirmedText,
              { fontSize: fontSize(baseFontSizes.body) },
            ]}
          >
            {confirmedText}
          </Text>
          <PrimaryButton
            label="確認した文字を取り消す"
            variant="secondary"
            onPress={handleClear}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
    padding: 14,
    borderRadius: layout.borderRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    color: colors.text,
    fontWeight: '700',
  },
  hint: {
    color: colors.textMuted,
    lineHeight: 24,
  },
  review: {
    gap: 12,
  },
  confirmed: {
    gap: 10,
  },
  confirmedLabel: {
    color: colors.primary,
    fontWeight: '700',
  },
  confirmedText: {
    color: colors.text,
    lineHeight: 28,
  },
});
