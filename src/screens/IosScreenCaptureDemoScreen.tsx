import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { IosScreenCapturePanel } from '../components/IosScreenCapturePanel';
import { Screen } from '../components/Screen';
import { colors } from '../constants/colors';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';
import {
  getIosScreenCaptureSessionState,
  startIosScreenCaptureKit,
  stopIosScreenCaptureKit,
  subscribeIosScreenCaptureSession,
  type IosScreenCaptureSessionState,
} from '../services/iosScreenCapture';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'IosScreenCaptureDemo'>;

/**
 * キャプチャ証明専用画面。OCR / AI / 通知 / 音声には繋げない。
 * スクロール禁止。実機 iOS 27 + development build が必要。
 */
export function IosScreenCaptureDemoScreen({ navigation }: Props) {
  const { fontSize } = useSettings();
  const [capture, setCapture] = useState<IosScreenCaptureSessionState>(() =>
    getIosScreenCaptureSessionState(),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return subscribeIosScreenCaptureSession(setCapture);
  }, []);

  const onStart = useCallback(() => {
    setBusy(true);
    void startIosScreenCaptureKit()
      .then((next) => setCapture(next))
      .finally(() => setBusy(false));
  }, []);

  const onStop = useCallback(() => {
    setBusy(true);
    void stopIosScreenCaptureKit()
      .then((next) => setCapture(next))
      .finally(() => setBusy(false));
  }, []);

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        title="画面共有デモ"
        showBack
        onPressBack={() => {
          void stopIosScreenCaptureKit();
          navigation.goBack();
        }}
      />

      <Text
        style={[styles.intro, { fontSize: fontSize(baseFontSizes.caption) }]}
        numberOfLines={3}
      >
        iOS 27 の ScreenCaptureKit で、共有中のフレーム件数だけを確認します。映像は保存・送信しません。
      </Text>

      <View style={styles.panel}>
        <IosScreenCapturePanel
          capture={capture}
          onStart={onStart}
          onStop={onStop}
          busy={busy}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 10,
  },
  intro: {
    color: colors.textSecondary,
    lineHeight: 22,
  },
  panel: {
    flex: 1,
    minHeight: 0,
  },
});
