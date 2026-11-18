import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/colors';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';
import type { IosScreenCaptureSessionState } from '../services/iosScreenCapture';
import { PrimaryButton } from './PrimaryButton';

type IosScreenCapturePanelProps = {
  capture: IosScreenCaptureSessionState;
  onStart: () => void;
  onStop: () => void;
  busy?: boolean;
};

function formatLastFrameAt(ms: number): string {
  if (!ms || ms <= 0) {
    return 'まだなし';
  }
  try {
    return new Date(ms).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return String(ms);
  }
}

/**
 * iOS 27 ScreenCaptureKit デモ用（ノンスクロール）。
 * phase / frameCount / lastFrameAt のみ。画像・OCR・AI は出さない。
 */
export function IosScreenCapturePanel({
  capture,
  onStart,
  onStop,
  busy = false,
}: IosScreenCapturePanelProps) {
  const { fontSize } = useSettings();
  const unsupported = capture.phase === 'unsupported' || !capture.availability.supported;
  const streaming =
    capture.phase === 'streaming' || capture.phase === 'background';
  const picking = capture.phase === 'picking';

  return (
    <View style={styles.root}>
      <Text
        style={[styles.label, { fontSize: fontSize(baseFontSizes.caption) }]}
        numberOfLines={1}
      >
        {capture.availability.label}
      </Text>
      <Text
        style={[styles.hint, { fontSize: fontSize(baseFontSizes.caption) }]}
        numberOfLines={3}
      >
        {capture.statusMessage}
      </Text>

      <View style={styles.metrics}>
        <Text
          style={[styles.metric, { fontSize: fontSize(baseFontSizes.body) }]}
          numberOfLines={1}
        >
          状態: {capture.phase}
        </Text>
        <Text
          style={[styles.metric, { fontSize: fontSize(baseFontSizes.body) }]}
          numberOfLines={1}
        >
          フレーム数: {capture.frameCount}
        </Text>
        <Text
          style={[styles.metric, { fontSize: fontSize(baseFontSizes.body) }]}
          numberOfLines={1}
        >
          最終受信: {formatLastFrameAt(capture.lastFrameAt)}
        </Text>
        {capture.appState !== 'unknown' ? (
          <Text
            style={[
              styles.metricMuted,
              { fontSize: fontSize(baseFontSizes.caption) },
            ]}
            numberOfLines={1}
          >
            アプリ: {capture.appState}
            {capture.width > 0 ? ` / ${capture.width}×${capture.height}` : ''}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label={
            picking
              ? 'ピッカー表示中…'
              : streaming
                ? '共有中'
                : unsupported
                  ? '共有不可'
                  : '画面共有を開始'
          }
          onPress={onStart}
          disabled={unsupported || picking || streaming || busy}
        />
        <PrimaryButton
          label="共有を停止"
          variant="secondary"
          onPress={onStop}
          disabled={unsupported || (!streaming && !picking) || busy}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
    flexShrink: 1,
  },
  label: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  hint: {
    color: colors.textSecondary,
    lineHeight: 22,
  },
  metrics: {
    gap: 4,
    paddingVertical: 4,
  },
  metric: {
    color: colors.text,
    fontWeight: '700',
  },
  metricMuted: {
    color: colors.textMuted,
  },
  actions: {
    gap: 8,
  },
});
