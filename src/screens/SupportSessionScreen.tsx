import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { SafetyPhoneConsentPanel } from '../components/SafetyPhoneConsentPanel';
import { Screen } from '../components/Screen';
import { riskLevelLabel } from '../services/ai/schema';
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
  armSafetyScreenRead,
  disarmSafetyScreenRead,
} from '../services/androidAssist/safetyScreenText';
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
  extractPhoneCandidates,
  resolveSafetyInspectMode,
  type SafetyInspectResult,
} from '../services/security';
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

type SafetyUiPhase = 'none' | 'phone_consent' | 'result';

/**
 * 支援セッション: start → guiding（一手ずつ）→ offer_end → EndSupport。
 * Phase D: 利用者開始のフレーム取り込み＋端末内 OCR（確認済み文字のみ案内へ）。
 * Android: 任意で MediaProjection 背面支援（同意済みのときのみ）。
 * 安全性: 電話／メール選択後に MediaProjection 背面検出 → 通知＋TTSのみ
 * （結果のために Activity を前面に戻さない）。スクロール禁止。
 */
export function SupportSessionScreen({ navigation, route }: Props) {
  const { featureId, summary, backgroundAssist } = route.params;
  const feature = getFeatureById(featureId);
  const { fontSize, settings } = useSettings();
  const isSafety = featureId === 'safetyCheck';
  const safetyMode = isSafety
    ? resolveSafetyInspectMode({ summary }) ?? 'phone'
    : null;

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
  const [safetyUi, setSafetyUi] = useState<SafetyUiPhase>('none');
  const [safetyResult, setSafetyResult] = useState<SafetyInspectResult | null>(
    null,
  );
  const [consentPhone, setConsentPhone] = useState('');
  const [pendingSafetyText, setPendingSafetyText] = useState('');
  const startedRef = useRef(false);
  // 安全性も背面 MediaProjection 可（同意済みのとき）。結果は通知+TTS が主経路。
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
    disarmSafetyScreenRead();
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

  // 背面支援の OCR 変化 → 画面の一手を更新（ネイティブ通知/TTS が主。デモ明示）
  // 安全性: Activity を前面に戻さず、もし画面が残っていれば表示だけ同期する。
  useEffect(() => {
    const g = androidAssist.lastGuidance;
    if (!g || phase !== 'guiding') {
      return;
    }
    setScript({
      id: `android-assist-${g.stepId}`,
      title: isSafety ? '安全性の背面案内' : '背面支援の案内',
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
    if (isSafety && g.stageId === 'safety-result') {
      setSafetyUi('result');
    }
  }, [androidAssist.lastGuidance, phase, isSafety]);

  // セッション開始: 端末内AI（未接続時はデモ）＋収録境界＋通知許可＋任意の背面支援
  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    void (async () => {
      startCaptureSession(featureId);
      if (safetyMode) {
        armSafetyScreenRead(safetyMode);
      }
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
      disarmSafetyScreenRead();
      void stopAndroidAssistSession();
      stopCaptureSession();
      void dismissSessionNotifications();
    };
  }, [featureId, summary, wantsBackgroundAssist, settings.voiceEnabled, safetyMode]);

  useEffect(() => {
    return addEndSupportResponseListener(() => {
      goEndSupport();
    });
  }, [goEndSupport]);

  // 一手ごとに画面文言＋通知＋音声（OCR 確認中・同意 UI 中は抑止）
  useEffect(() => {
    if (
      phase !== 'guiding' ||
      !step ||
      reviewingCapture ||
      safetyUi === 'phone_consent'
    ) {
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
    safetyUi,
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
    void requestUserFrame({
      preferAccessibilityText: isSafety,
    });
  };

  const applySafetyRebuild = async (
    confirmedText: string,
    searchConsent: boolean,
  ) => {
    const rebuilt = await rebuildGuidanceFromConfirmedFrame({
      featureId,
      baseSummary: summary,
      confirmedText,
      searchConsent,
    });
    setScript(rebuilt.script);
    setStepIndex(0);
    setTone('normal');
    setPhase('guiding');
    if (rebuilt.safetyResult) {
      setSafetyResult(rebuilt.safetyResult);
      setSafetyUi('result');
    } else {
      setSafetyUi('none');
    }
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
        if (isSafety && safetyMode === 'phone') {
          const phones = extractPhoneCandidates(confirmed.text);
          if (phones.length > 0) {
            // まず端末内結果。公開情報は同意パネルから。
            setPendingSafetyText(confirmed.text);
            setConsentPhone(phones[0].display);
            await applySafetyRebuild(confirmed.text, false);
            setSafetyUi('phone_consent');
            return;
          }
        }
        await applySafetyRebuild(confirmed.text, false);
      } finally {
        setGuidanceBusy(false);
      }
    })();
  };

  const handlePhoneSearchConsent = () => {
    if (guidanceBusy || !pendingSafetyText.trim()) {
      return;
    }
    const textForSearch = consentPhone.trim()
      ? `${consentPhone.trim()}\n${pendingSafetyText}`
      : pendingSafetyText;
    setGuidanceBusy(true);
    void (async () => {
      try {
        await applySafetyRebuild(textForSearch, true);
      } finally {
        setGuidanceBusy(false);
      }
    })();
  };

  const handleSkipPhoneSearch = () => {
    setSafetyUi(safetyResult ? 'result' : 'none');
  };

  const aiDemo = !isOnDeviceAiReady() || script?.isDemo !== false;
  const assistActive =
    wantsBackgroundAssist &&
    (androidAssist.phase === 'running' || androidAssist.phase === 'paused');
  // 背面支援中は手動OCRパネルを隠し、一手だけに集中（確認中は表示）
  // 安全性の同意／結果表示中はキャプチャパネルを隠して1画面に収める
  const showCapturePanel =
    phase !== 'starting' &&
    safetyUi === 'none' &&
    (!assistActive || reviewingCapture);
  const showSafetyConsent = safetyUi === 'phone_consent';
  const showSafetyResultBadge =
    safetyUi === 'result' && safetyResult != null && !showSafetyConsent;

  const nextLabel =
    phase === 'offer_end'
      ? END_SUPPORT_DISPLAY
      : phase === 'starting'
        ? '案内を準備しています…'
        : displayText;

  const footer = (
    <View style={styles.footerInner}>
      {phase === 'guiding' && !reviewingCapture && !showSafetyConsent ? (
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

      {showSafetyConsent ? (
        <SafetyPhoneConsentPanel
          phoneNumber={consentPhone}
          onChangePhoneNumber={setConsentPhone}
          busy={guidanceBusy}
          onSearch={handlePhoneSearchConsent}
          onCancel={handleSkipPhoneSearch}
        />
      ) : null}

      {!reviewingCapture && !showSafetyConsent ? (
        <View style={styles.instructionBlock}>
          {showSafetyResultBadge && safetyResult ? (
            <Text
              style={[
                styles.safetyBadge,
                { fontSize: fontSize(baseFontSizes.body) },
              ]}
              numberOfLines={1}
            >
              {riskLevelLabel(safetyResult.riskLevel ?? 'insufficient_info')}
              {safetyResult.mode === 'demo' || safetyResult.mode === 'offline'
                ? `（${safetyResult.mode === 'demo' ? 'デモ' : 'AI未接続'}）`
                : ''}
            </Text>
          ) : (
            <Text
              style={[styles.nextEyebrow, { fontSize: fontSize(baseFontSizes.caption) }]}
              numberOfLines={1}
            >
              次にすること
            </Text>
          )}
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
  safetyBadge: {
    color: colors.warning,
    fontWeight: '700',
    lineHeight: 28,
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
