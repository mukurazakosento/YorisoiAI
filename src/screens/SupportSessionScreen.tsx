import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { SessionCapturePanel } from '../components/SessionCapturePanel';
import { colors } from '../constants/colors';
import { getFeatureById } from '../constants/features';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';
import {
  assistIntervalForFeature,
  getAndroidAssistSessionState,
  pauseAndroidAssistSession,
  resumeAndroidAssistSession,
  startAndroidAssistSession,
  stopAndroidAssistSession,
  subscribeAndroidAssistSession,
  type AndroidAssistSessionState,
} from '../services/androidAssist';
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
  replaySpeaking,
  speakLatest,
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
 * Android: 任意で MediaProjection 背面支援（同意済みのときのみ）。
 * スクロール禁止。消音でも画面の displayText は必ず出す。
 */
export function SupportSessionScreen({ navigation, route }: Props) {
  const { featureId, summary, backgroundAssist } = route.params;
  const feature = getFeatureById(featureId);
  const { fontSize, settings } = useSettings();

  const [phase, setPhase] = useState<SupportSessionPhase>('starting');
  const [script, setScript] = useState<SessionScript | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [tone, setTone] = useState<SessionStepTone>('normal');
  const [capture, setCapture] = useState<CaptureSessionState>(() =>
    getCaptureSessionState(),
  );
  const [androidAssist, setAndroidAssist] = useState<AndroidAssistSessionState>(
    () => getAndroidAssistSessionState(),
  );
  const [guidanceBusy, setGuidanceBusy] = useState(false);
  const startedRef = useRef(false);
  const wantsBackgroundAssist = backgroundAssist === true;

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
    void stopAndroidAssistSession();
    stopCaptureSession();
    void dismissSessionNotifications();
    navigation.navigate('EndSupport', { featureId, summary });
  }, [navigation, featureId, summary]);

  useEffect(() => {
    return subscribeCaptureSession(setCapture);
  }, []);

  useEffect(() => {
    return subscribeAndroidAssistSession(setAndroidAssist);
  }, []);

  // 背面支援の OCR 変化 → 画面の一手を更新（ネイティブ通知/TTS と併用。デモ明示）
  useEffect(() => {
    const g = androidAssist.lastGuidance;
    if (!g || phase !== 'guiding') {
      return;
    }
    setScript({
      id: `android-assist-${g.stepId}`,
      title: '背面支援の案内',
      isDemo: true,
      steps: [
        {
          displayText: g.displayText,
          voiceText: g.voiceText,
          simplifyDisplayText: g.displayText,
          simplifyVoiceText: g.voiceText,
        },
      ],
    });
    setStepIndex(0);
    setTone('normal');
  }, [androidAssist.lastGuidance, phase]);

  // セッション開始: 端末内AI（未接続時はデモ）＋収録境界＋通知許可＋任意の背面支援
  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    void (async () => {
      startCaptureSession(featureId);
      const guidance = await buildGuidanceScript({ featureId, summary });
      setScript(guidance.script);

      await ensureNotificationPermission();

      if (wantsBackgroundAssist) {
        await startAndroidAssistSession({
          featureId,
          goalSummary: summary,
          voiceEnabled: settings.voiceEnabled,
          // Ops ~20s; 文章説明 ~4s so transient popups are not missed.
          intervalMs: assistIntervalForFeature(featureId),
        });
      }

      setPhase('guiding');
      setStepIndex(0);
      setTone('normal');
    })();

    return () => {
      void stopSpeaking().catch(() => {
        // no-op
      });
      void stopAndroidAssistSession();
      stopCaptureSession();
      void dismissSessionNotifications();
    };
  }, [featureId, summary, wantsBackgroundAssist, settings.voiceEnabled]);

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

    void presentInstructionNotification(displayText);

    if (settings.voiceEnabled) {
      void speakLatest({
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

    void presentEndSupportNotification();

    if (settings.voiceEnabled) {
      void speakLatest({
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
      } finally {
        setGuidanceBusy(false);
      }
    })();
  };

  const aiDemo = !isOnDeviceAiReady() || script?.isDemo !== false;
  const assistActive =
    wantsBackgroundAssist &&
    (androidAssist.phase === 'running' || androidAssist.phase === 'paused');
  // 背面支援中は手動OCRパネルを隠し、一手だけに集中（確認中は表示）
  const showCapturePanel =
    phase !== 'starting' && (!assistActive || reviewingCapture);

  const nextLabel =
    phase === 'offer_end'
      ? END_SUPPORT_DISPLAY
      : phase === 'starting'
        ? '案内を準備しています…'
        : displayText;

  const footer = (
    <View style={styles.footerInner}>
      {phase === 'guiding' && !reviewingCapture ? (
        <>
          <PrimaryButton
            label="できた"
            onPress={handleDone}
            disabled={guidanceBusy}
          />
          <View style={styles.secondaryRow}>
            <View style={styles.secondaryHalf}>
              <PrimaryButton
                label="分からない"
                variant="secondary"
                onPress={handleSimplify}
              />
            </View>
            <View style={styles.secondaryHalf}>
              <PrimaryButton
                label="もう一度"
                variant="secondary"
                onPress={handleReplay}
                disabled={!settings.voiceEnabled}
              />
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={goEndSupport}
            style={styles.endLink}
          >
            <Text
              style={[styles.endLinkText, { fontSize: fontSize(baseFontSizes.caption) }]}
            >
              終了
            </Text>
          </Pressable>
        </>
      ) : null}

      {phase === 'offer_end' ? (
        <>
          <PrimaryButton label="終了する" onPress={goEndSupport} />
          <PrimaryButton
            label="もう一度"
            variant="secondary"
            onPress={handleReplay}
            disabled={!settings.voiceEnabled}
          />
        </>
      ) : null}

      {phase === 'starting' ? (
        <PrimaryButton label="準備中…" disabled onPress={() => {}} />
      ) : null}

      {reviewingCapture ? (
        <PrimaryButton
          label="この文字で進む"
          onPress={handleConfirmDraft}
          disabled={guidanceBusy}
        />
      ) : null}
    </View>
  );

  return (
    <Screen contentStyle={styles.content} footer={footer}>
      <AppHeader
        title={feature.title}
        showBack
        onPressBack={() => {
          void stopSpeaking().catch(() => {
            // no-op
          });
          void stopAndroidAssistSession();
          stopCaptureSession();
          navigation.goBack();
        }}
      />

      <View style={styles.metaRow}>
        {aiDemo ? (
          <Text
            style={[styles.demoBadge, { fontSize: fontSize(baseFontSizes.caption) }]}
          >
            デモ
          </Text>
        ) : (
          <Text
            style={[styles.featureLabel, { fontSize: fontSize(baseFontSizes.caption) }]}
            numberOfLines={1}
          >
            案内
          </Text>
        )}
        {assistActive ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (androidAssist.phase === 'paused') {
                void resumeAndroidAssistSession();
              } else {
                void pauseAndroidAssistSession();
              }
            }}
          >
            <Text
              style={[styles.assistAction, { fontSize: fontSize(baseFontSizes.caption) }]}
            >
              {androidAssist.phase === 'paused' ? '再開' : '一時停止'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {showCapturePanel ? (
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
        <View style={styles.instructionBlock}>
          <Text
            style={[styles.nextEyebrow, { fontSize: fontSize(baseFontSizes.caption) }]}
            numberOfLines={1}
          >
            次にすること
          </Text>
          <Text
            style={[
              styles.displayText,
              { fontSize: fontSize(baseFontSizes.title) },
            ]}
            numberOfLines={2}
            accessibilityRole="header"
          >
            {nextLabel}
          </Text>
          {!settings.voiceEnabled ? (
            <Text
              style={[styles.muteHint, { fontSize: fontSize(baseFontSizes.caption) }]}
              numberOfLines={1}
            >
              {SPEECH_DISABLED_HELP}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 28,
  },
  assistAction: {
    color: colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  featureLabel: {
    color: colors.primary,
    fontWeight: '700',
  },
  demoBadge: {
    color: colors.warning,
    fontWeight: '700',
  },
  instructionBlock: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 8,
  },
  nextEyebrow: {
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  displayText: {
    color: colors.text,
    fontWeight: '700',
    lineHeight: 36,
  },
  muteHint: {
    color: colors.textMuted,
    lineHeight: 22,
  },
  footerInner: {
    gap: 10,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryHalf: {
    flex: 1,
  },
  endLink: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  endLinkText: {
    color: colors.textMuted,
    fontWeight: '700',
  },
});
