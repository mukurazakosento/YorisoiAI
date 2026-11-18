import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/colors';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';
import type { SessionNotificationPermission } from '../services/notifications';
import type { WebCaptureSessionState } from '../services/webCapture';
import { PrimaryButton } from './PrimaryButton';

type WebCapturePanelProps = {
  capture: WebCaptureSessionState;
  aiStatusLabel: string;
  notifyStatus: SessionNotificationPermission;
  onStartShare: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onUseOcrText: () => void;
  onRequestNotifyPermission: () => void;
  guidanceBusy?: boolean;
};

/**
 * Web 支援セッション用: 画面共有／OCR／AI の正直なステータスと操作。
 * ノンスクロール前提。未対応時は不可を明示。
 */
export function WebCapturePanel({
  capture,
  aiStatusLabel,
  notifyStatus,
  onStartShare,
  onPause,
  onResume,
  onStop,
  onUseOcrText,
  onRequestNotifyPermission,
  guidanceBusy = false,
}: WebCapturePanelProps) {
  const { fontSize } = useSettings();
  const unavailable = !capture.availability.canStartShare;
  const sharing = capture.sharing;
  const ocrPreview = capture.lastOcr?.text?.trim() ?? '';
  const showNotifyButton = notifyStatus.webPermission === 'default';

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
          {capture.availability.ocrLabel}
        </Text>
        <Text
          style={[styles.status, { fontSize: fontSize(baseFontSizes.caption) }]}
          numberOfLines={1}
        >
          AI：{aiStatusLabel}
        </Text>
      </View>

      <Text
        style={[styles.hint, { fontSize: fontSize(baseFontSizes.caption) }]}
        numberOfLines={2}
      >
        {capture.statusMessage}
      </Text>

      {showNotifyButton ? (
        <PrimaryButton
          label="通知を許可"
          variant="secondary"
          onPress={onRequestNotifyPermission}
        />
      ) : null}

      {unavailable ? (
        <PrimaryButton label="画面共有は使えません" disabled onPress={() => {}} />
      ) : !sharing ? (
        <PrimaryButton
          label={
            capture.phase === 'requesting'
              ? '許可を待っています…'
              : '画面共有を開始'
          }
          onPress={onStartShare}
          disabled={capture.phase === 'requesting'}
        />
      ) : (
        <View style={styles.shareActions}>
          <View style={styles.row}>
            {capture.paused || capture.tabHidden ? (
              <View style={styles.half}>
                <PrimaryButton
                  label="再開"
                  variant="secondary"
                  onPress={onResume}
                  disabled={capture.tabHidden}
                />
              </View>
            ) : (
              <View style={styles.half}>
                <PrimaryButton
                  label="一時停止"
                  variant="secondary"
                  onPress={onPause}
                />
              </View>
            )}
            <View style={styles.half}>
              <PrimaryButton
                label="共有を停止"
                variant="secondary"
                onPress={onStop}
              />
            </View>
          </View>
          {ocrPreview ? (
            <>
              <Text
                style={[
                  styles.ocrPreview,
                  { fontSize: fontSize(baseFontSizes.caption) },
                ]}
                numberOfLines={2}
              >
                読取: {ocrPreview}
              </Text>
              <PrimaryButton
                label={
                  guidanceBusy
                    ? '案内を更新しています…'
                    : 'この文字で案内する'
                }
                onPress={onUseOcrText}
                disabled={guidanceBusy}
              />
            </>
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
  shareActions: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  half: {
    flex: 1,
  },
  ocrPreview: {
    color: colors.primary,
    fontWeight: '600',
    lineHeight: 20,
  },
});
