import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/colors';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';
import { useSpeechStatus } from '../hooks/useSpeechStatus';
import {
  pauseSpeaking,
  replaySpeaking,
  resumeSpeaking,
  SPEECH_DISABLED_HELP,
  SPEECH_MUTE_HELP,
  stopSpeaking,
} from '../services/speech';
import { PrimaryButton } from './PrimaryButton';

type SpeechControlsProps = {
  /** 音声用の詳しい案内（無いときは displayFallback） */
  voiceText?: string | null;
  /** 画面表示文。音声オフや消音時のバックアップ */
  displayFallback?: string | null;
  disabled?: boolean;
  /** 消音・音量のヒントを出すか（既定: true） */
  showMuteHelp?: boolean;
};

/**
 * 開始相当（もう一度聞く）・一時停止・再開・停止。
 * 画面の displayText は親側で常時表示すること。ここでは操作だけ担当する。
 */
export function SpeechControls({
  voiceText,
  displayFallback,
  disabled = false,
  showMuteHelp = true,
}: SpeechControlsProps) {
  const { fontSize, settings } = useSettings();
  const status = useSpeechStatus();

  const text = (voiceText || displayFallback || '').trim();
  if (!text) {
    return null;
  }

  const voiceOff = !settings.voiceEnabled;
  const controlsDisabled = disabled || voiceOff;
  const speaking = status === 'speaking';
  const paused = status === 'paused';

  const handleReplay = () => {
    if (controlsDisabled) {
      return;
    }
    void replaySpeaking({
      text,
      rate: settings.speechRate,
      language: 'ja-JP',
    }).catch(() => {
      // 失敗しても画面文言は残る
    });
  };

  const handlePause = () => {
    if (controlsDisabled) {
      return;
    }
    void pauseSpeaking().catch(() => {
      // no-op
    });
  };

  const handleResume = () => {
    if (controlsDisabled) {
      return;
    }
    void resumeSpeaking().catch(() => {
      void replaySpeaking({
        text,
        rate: settings.speechRate,
        language: 'ja-JP',
      }).catch(() => {
        // no-op
      });
    });
  };

  const handleStop = () => {
    void stopSpeaking().catch(() => {
      // no-op
    });
  };

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      {voiceOff ? (
        <Text
          style={[styles.help, { fontSize: fontSize(baseFontSizes.caption) }]}
        >
          {SPEECH_DISABLED_HELP}
        </Text>
      ) : showMuteHelp ? (
        <Text
          style={[styles.help, { fontSize: fontSize(baseFontSizes.caption) }]}
        >
          {SPEECH_MUTE_HELP}
        </Text>
      ) : null}

      <View style={styles.buttons}>
        <PrimaryButton
          label="もう一度聞く"
          variant="secondary"
          onPress={handleReplay}
          disabled={controlsDisabled}
        />
        {speaking ? (
          <PrimaryButton
            label="一時停止"
            variant="secondary"
            onPress={handlePause}
            disabled={controlsDisabled}
          />
        ) : null}
        {paused ? (
          <PrimaryButton
            label="続きから聞く"
            variant="secondary"
            onPress={handleResume}
            disabled={controlsDisabled}
          />
        ) : null}
        {speaking || paused ? (
          <PrimaryButton
            label="読み上げを止める"
            variant="secondary"
            onPress={handleStop}
            disabled={disabled}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  help: {
    color: colors.textMuted,
    lineHeight: 26,
  },
  buttons: {
    gap: 12,
  },
});
