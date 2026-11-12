import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { colors } from '../constants/colors';
import { getFeatureById } from '../constants/features';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';
import {
  addEndSupportResponseListener,
  dismissSessionNotifications,
  ensureNotificationPermission,
  presentEndSupportNotification,
  presentInstructionNotification,
} from '../services/notifications';
import {
  buildGuidanceScript,
  isOnDeviceAiReady,
} from '../services/onDeviceAi';
import {
  END_SUPPORT_DISPLAY,
  END_SUPPORT_VOICE,
} from '../services/session/demoSteps';
import {
  SPEECH_DISABLED_HELP,
  SPEECH_MUTE_HELP,
  replaySpeaking,
  speak,
  stopSpeaking,
} from '../services/speech';
import type { RootStackParamList } from '../types/navigation';
import type {
  SessionScript,
  SessionStepTone,
  SupportSessionPhase,
} from '../types/session';

type Props = NativeStackScreenProps<RootStackParamList, 'SupportSession'>;

/**
 * 支援セッション: start → guiding（一手ずつ）→ offer_end → EndSupport。
 * 通知＋音声で案内。画面収録／定期OCRは準備中のまま（偽動作なし）。
 * スクロール禁止。消音でも画面の displayText は必ず出す。
 */
export function SupportSessionScreen({ navigation, route }: Props) {
  const { featureId, summary } = route.params;
  const feature = getFeatureById(featureId);
  const { fontSize, settings } = useSettings();

  const [phase, setPhase] = useState<SupportSessionPhase>('starting');
  const [script, setScript] = useState<SessionScript | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [tone, setTone] = useState<SessionStepTone>('normal');
  const [notifyHint, setNotifyHint] = useState('通知の準備中…');
  const startedRef = useRef(false);

  const step = script?.steps[stepIndex];
  const displayText =
    step == null
      ? ''
      : tone === 'simplify'
        ? step.simplifyDisplayText
        : step.displayText;
  const voiceText =
    step == null
      ? ''
      : tone === 'simplify'
        ? step.simplifyVoiceText
        : step.voiceText;

  const goEndSupport = useCallback(() => {
    void stopSpeaking().catch(() => {
      // no-op
    });
    void dismissSessionNotifications();
    navigation.navigate('EndSupport', { featureId, summary });
  }, [navigation, featureId, summary]);

  // セッション開始: 端末内AI（未接続時はデモ脚本）＋通知許可
  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    void (async () => {
      const guidance = await buildGuidanceScript({ featureId, summary });
      setScript(guidance.script);

      const permission = await ensureNotificationPermission();
      setNotifyHint(permission.detail);
      setPhase('guiding');
      setStepIndex(0);
      setTone('normal');
    })();

    return () => {
      void stopSpeaking().catch(() => {
        // no-op
      });
      void dismissSessionNotifications();
    };
  }, [featureId, summary]);

  // 終了通知タップ → EndSupport（OSが拒否しても画面内ボタンで同等）
  useEffect(() => {
    return addEndSupportResponseListener(() => {
      goEndSupport();
    });
  }, [goEndSupport]);

  // 一手ごとに画面文言＋通知＋音声
  useEffect(() => {
    if (phase !== 'guiding' || !step) {
      return;
    }

    void presentInstructionNotification(displayText).then((result) => {
      if (!result.ok && result.reason) {
        setNotifyHint(
          typeof result.reason === 'string' && result.reason.length > 8
            ? result.reason
            : '通知の代わりに、画面の文字で案内しています。',
        );
      }
    });

    if (settings.voiceEnabled) {
      void speak({
        text: voiceText || displayText,
        rate: settings.speechRate,
        language: 'ja-JP',
      }).catch(() => {
        // 消音・失敗でも画面文言は残す
      });
    } else {
      void stopSpeaking().catch(() => {
        // no-op
      });
    }
  }, [
    phase,
    stepIndex,
    tone,
    displayText,
    voiceText,
    settings.voiceEnabled,
    settings.speechRate,
    step,
  ]);

  // 案内完了 → 終了オファー＋終了通知
  useEffect(() => {
    if (phase !== 'offer_end') {
      return;
    }

    void presentEndSupportNotification().then((result) => {
      if (!result.ok) {
        setNotifyHint(
          '通知が使えないため、下のボタンから支援を終了してください。',
        );
      } else {
        setNotifyHint('通知「ここをタップで支援を終了」も送りました。');
      }
    });

    if (settings.voiceEnabled) {
      void speak({
        text: END_SUPPORT_VOICE,
        rate: settings.speechRate,
        language: 'ja-JP',
      }).catch(() => {
        // no-op
      });
    }
  }, [phase, settings.voiceEnabled, settings.speechRate]);

  const handleDone = () => {
    if (!script) {
      return;
    }
    if (stepIndex + 1 >= script.steps.length) {
      setPhase('offer_end');
      return;
    }
    setTone('normal');
    setStepIndex((prev) => prev + 1);
  };

  const handleSimplify = () => {
    setTone('simplify');
  };

  const handleReplay = () => {
    if (!settings.voiceEnabled) {
      return;
    }
    const text =
      phase === 'offer_end'
        ? END_SUPPORT_VOICE
        : voiceText || displayText;
    if (!text) {
      return;
    }
    void replaySpeaking({
      text,
      rate: settings.speechRate,
      language: 'ja-JP',
    }).catch(() => {
      // no-op
    });
  };

  const aiDemo = !isOnDeviceAiReady() || script?.isDemo !== false;
  const stepLabel =
    script && phase === 'guiding'
      ? `いまの手順 ${stepIndex + 1} / ${script.steps.length}`
      : phase === 'offer_end'
        ? '案内はひととおり終わりです'
        : '準備しています…';

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        title="支援セッション"
        showBack
        onPressBack={() => {
          void stopSpeaking().catch(() => {
            // no-op
          });
          navigation.goBack();
        }}
      />

      <View style={styles.metaRow}>
        <Text
          style={[styles.featureLabel, { fontSize: fontSize(baseFontSizes.caption) }]}
          numberOfLines={1}
        >
          {feature.title}
        </Text>
        {aiDemo ? (
          <Text
            style={[styles.demoBadge, { fontSize: fontSize(baseFontSizes.caption) }]}
          >
            デモ
          </Text>
        ) : null}
      </View>

      <Text
        style={[styles.summary, { fontSize: fontSize(baseFontSizes.caption) }]}
        numberOfLines={1}
      >
        {summary}
      </Text>

      <View style={styles.captureRow}>
        <Text
          style={[styles.captureText, { fontSize: fontSize(baseFontSizes.caption) }]}
          numberOfLines={1}
        >
          画面収録：準備中
        </Text>
        <Text
          style={[styles.captureText, { fontSize: fontSize(baseFontSizes.caption) }]}
          numberOfLines={1}
        >
          定期OCR：準備中
        </Text>
      </View>

      <Text
        style={[styles.stepLabel, { fontSize: fontSize(baseFontSizes.caption) }]}
      >
        {stepLabel}
      </Text>

      <View style={styles.instructionCard}>
        <Text
          style={[
            styles.displayText,
            { fontSize: fontSize(baseFontSizes.title) },
          ]}
          numberOfLines={4}
          accessibilityRole="header"
        >
          {phase === 'offer_end'
            ? END_SUPPORT_DISPLAY
            : phase === 'starting'
              ? '案内を準備しています…'
              : displayText}
        </Text>
        <Text
          style={[styles.notifyHint, { fontSize: fontSize(baseFontSizes.caption) }]}
          numberOfLines={2}
        >
          {notifyHint}
        </Text>
        <Text
          style={[styles.muteHint, { fontSize: fontSize(baseFontSizes.caption) }]}
          numberOfLines={2}
        >
          {settings.voiceEnabled ? SPEECH_MUTE_HELP : SPEECH_DISABLED_HELP}
        </Text>
      </View>

      <View style={styles.actions}>
        {phase === 'guiding' ? (
          <>
            <PrimaryButton label="できました" onPress={handleDone} />
            <View style={styles.secondaryRow}>
              <View style={styles.secondaryHalf}>
                <PrimaryButton
                  label="分かりません"
                  variant="secondary"
                  onPress={handleSimplify}
                />
              </View>
              <View style={styles.secondaryHalf}>
                <PrimaryButton
                  label="もう一度聞く"
                  variant="secondary"
                  onPress={handleReplay}
                  disabled={!settings.voiceEnabled}
                />
              </View>
            </View>
            <PrimaryButton
              label="支援を終了する"
              variant="secondary"
              onPress={goEndSupport}
            />
          </>
        ) : null}

        {phase === 'offer_end' ? (
          <>
            <PrimaryButton
              label={END_SUPPORT_DISPLAY}
              onPress={goEndSupport}
            />
            <PrimaryButton
              label="もう一度聞く"
              variant="secondary"
              onPress={handleReplay}
              disabled={!settings.voiceEnabled}
            />
          </>
        ) : null}

        {phase === 'starting' ? (
          <PrimaryButton label="しばらくお待ちください…" disabled onPress={() => {}} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  featureLabel: {
    color: colors.primary,
    fontWeight: '700',
    flex: 1,
  },
  demoBadge: {
    color: colors.warning,
    fontWeight: '700',
  },
  summary: {
    color: colors.textSecondary,
    lineHeight: 22,
  },
  captureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  captureText: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  stepLabel: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  instructionCard: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    justifyContent: 'center',
  },
  displayText: {
    color: colors.text,
    fontWeight: '700',
    lineHeight: 34,
  },
  notifyHint: {
    color: colors.textSecondary,
    lineHeight: 22,
  },
  muteHint: {
    color: colors.textMuted,
    lineHeight: 22,
  },
  actions: {
    gap: 8,
    paddingBottom: 4,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryHalf: {
    flex: 1,
  },
});
