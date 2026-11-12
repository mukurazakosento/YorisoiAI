import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { SessionCapturePanel } from '../components/SessionCapturePanel';
import { colors } from '../constants/colors';
import { getFeatureById } from '../constants/features';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';
import {
  clearFrameDraft,
  confirmFrameText,
  getCaptureSessionState,
  rebuildGuidanceFromConfirmedFrame,
  requestUserFrame,
  shouldPreferOpenAppBeforeOcr,
  startCaptureSession,
  stopCaptureSession,
  subscribeCaptureSession,
  updateFrameDraft,
  type CaptureSessionState,
} from '../services/capture';
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
 * Phase D: 利用者開始のフレーム取り込み＋端末内 OCR（確認済み文字のみ案内へ）。
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
  const [capture, setCapture] = useState<CaptureSessionState>(() =>
    getCaptureSessionState(),
  );
  const [guidanceBusy, setGuidanceBusy] = useState(false);
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

  const reviewingCapture = capture.phase === 'review';
  // 安全性チェックは「開いた」あと（2手目以降）で読み取りを勧める
  const allowRead =
    !shouldPreferOpenAppBeforeOcr(featureId) || stepIndex >= 1 || Boolean(capture.confirmed);

  const goEndSupport = useCallback(() => {
    void stopSpeaking().catch(() => {
      // no-op
    });
    stopCaptureSession();
    void dismissSessionNotifications();
    navigation.navigate('EndSupport', { featureId, summary });
  }, [navigation, featureId, summary]);

  useEffect(() => {
    return subscribeCaptureSession(setCapture);
  }, []);

  // セッション開始: 端末内AI（未接続時はデモ）＋収録境界＋通知許可
  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    void (async () => {
      startCaptureSession(featureId);
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
      stopCaptureSession();
      void dismissSessionNotifications();
    };
  }, [featureId, summary]);

  useEffect(() => {
    return addEndSupportResponseListener(() => {
      goEndSupport();
    });
  }, [goEndSupport]);

  // 一手ごとに画面文言＋通知＋音声（OCR 確認中は抑止）
  useEffect(() => {
    if (phase !== 'guiding' || !step || reviewingCapture) {
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
    reviewingCapture,
  ]);

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

  const handleRequestFrame = () => {
    void requestUserFrame();
  };

  const handleConfirmDraft = () => {
    if (guidanceBusy) {
      return;
    }
    const confirmed = confirmFrameText();
    if (!confirmed) {
      return;
    }

    setGuidanceBusy(true);
    void (async () => {
      try {
        const rebuilt = await rebuildGuidanceFromConfirmedFrame({
          featureId,
          baseSummary: summary,
          confirmedText: confirmed.text,
        });
        setScript(rebuilt.script);
        setStepIndex(0);
        setTone('normal');
        setPhase('guiding');
        setNotifyHint('確認した画面の文字に合わせて案内を更新しました。');
      } finally {
        setGuidanceBusy(false);
      }
    })();
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
          stopCaptureSession();
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

      {phase !== 'starting' ? (
        <SessionCapturePanel
          featureId={featureId}
          capture={capture}
          allowRead={allowRead && phase === 'guiding'}
          onRequestFrame={handleRequestFrame}
          onConfirmDraft={handleConfirmDraft}
          onClearDraft={() => {
            clearFrameDraft();
          }}
          onChangeDraft={(text) => {
            updateFrameDraft(text);
          }}
        />
      ) : null}

      {!reviewingCapture ? (
        <>
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
              numberOfLines={3}
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
              numberOfLines={1}
            >
              {settings.voiceEnabled ? SPEECH_MUTE_HELP : SPEECH_DISABLED_HELP}
            </Text>
          </View>
        </>
      ) : null}

      <View style={styles.actions}>
        {phase === 'guiding' && !reviewingCapture ? (
          <>
            <PrimaryButton
              label="できました"
              onPress={handleDone}
              disabled={guidanceBusy}
            />
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
    gap: 6,
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
    lineHeight: 20,
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    justifyContent: 'center',
  },
  displayText: {
    color: colors.text,
    fontWeight: '700',
    lineHeight: 30,
  },
  notifyHint: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  muteHint: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  actions: {
    gap: 6,
    paddingBottom: 2,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryHalf: {
    flex: 1,
  },
});
