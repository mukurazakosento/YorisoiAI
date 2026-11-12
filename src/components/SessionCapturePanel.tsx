import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../constants/colors';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';
import type { CaptureSessionState } from '../services/capture';
import { getFeatureCapturePath } from '../services/capture';
import type { FeatureId } from '../types/navigation';
import { PrimaryButton } from './PrimaryButton';

type SessionCapturePanelProps = {
  featureId: FeatureId;
  capture: CaptureSessionState;
  /** 安全性: まだ「開いた」段階なら読み取りを控えめに */
  allowRead: boolean;
  onRequestFrame: () => void;
  onConfirmDraft: () => void;
  onClearDraft: () => void;
  onChangeDraft: (text: string) => void;
};

/**
 * 支援セッション用のコンパクトな収録／OCR UI（ノンスクロール前提）。
 * 画像は扱わず、確認前の文字ドラフトとステータスだけを出す。
 */
export function SessionCapturePanel({
  featureId,
  capture,
  allowRead,
  onRequestFrame,
  onConfirmDraft,
  onClearDraft,
  onChangeDraft,
}: SessionCapturePanelProps) {
  const { fontSize } = useSettings();
  const path = getFeatureCapturePath(featureId);
  const unavailable = capture.phase === 'unavailable';
  const reviewing = capture.phase === 'review';
  const picking = capture.phase === 'picking';
  const confirmedPreview = capture.confirmed?.text?.trim() ?? '';

  return (
    <View style={styles.root}>
      <View style={styles.statusRow}>
        <Text
          style={[styles.status, { fontSize: fontSize(baseFontSizes.caption) }]}
          numberOfLines={1}
        >
          {capture.availability.recordingLabel}
        </Text>
        <Text
          style={[styles.status, { fontSize: fontSize(baseFontSizes.caption) }]}
          numberOfLines={1}
        >
          {capture.availability.periodicOcrLabel}
        </Text>
      </View>

      <Text
        style={[styles.hint, { fontSize: fontSize(baseFontSizes.caption) }]}
        numberOfLines={2}
      >
        {capture.statusMessage ?? path.hint}
      </Text>

      {reviewing ? (
        <View style={styles.reviewBlock}>
          <TextInput
            value={capture.draft?.text ?? ''}
            onChangeText={onChangeDraft}
            multiline
            numberOfLines={3}
            style={[
              styles.draftInput,
              { fontSize: fontSize(baseFontSizes.body) },
            ]}
            placeholder="読み取った文字"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="読み取った文字の確認"
          />
          <View style={styles.reviewActions}>
            <View style={styles.half}>
              <PrimaryButton
                label="この文字で進む"
                onPress={onConfirmDraft}
              />
            </View>
            <View style={styles.half}>
              <PrimaryButton
                label="やめる"
                variant="secondary"
                onPress={onClearDraft}
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.idleActions}>
          <PrimaryButton
            label={
              picking
                ? '読み取り中…'
                : unavailable
                  ? '読み取り不可'
                  : path.readButtonLabel
            }
            variant="secondary"
            onPress={onRequestFrame}
            disabled={unavailable || picking || !allowRead}
          />
          {confirmedPreview ? (
            <Text
              style={[
                styles.confirmed,
                { fontSize: fontSize(baseFontSizes.caption) },
              ]}
              numberOfLines={2}
            >
              確認済み: {confirmedPreview}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 6,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  status: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  hint: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  reviewBlock: {
    gap: 6,
  },
  draftInput: {
    minHeight: 64,
    maxHeight: 88,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 8,
  },
  half: {
    flex: 1,
  },
  idleActions: {
    gap: 4,
  },
  confirmed: {
    color: colors.primary,
    fontWeight: '600',
    lineHeight: 20,
  },
});
