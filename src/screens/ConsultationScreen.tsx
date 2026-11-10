import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { ChoiceButton } from '../components/ChoiceButton';
import { ExplanationResultPanel } from '../components/ExplanationResultPanel';
import { GuidanceStepPanel } from '../components/GuidanceStepPanel';
import { InfoCard } from '../components/InfoCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { SafetyPhoneConsentPanel } from '../components/SafetyPhoneConsentPanel';
import { SafetyResultPanel } from '../components/SafetyResultPanel';
import { Screen } from '../components/Screen';
import {
  ScreenshotOcrPanel,
  type ConfirmedOcrPayload,
} from '../components/ScreenshotOcrPanel';
import { TextInputField } from '../components/TextInputField';
import { colors } from '../constants/colors';
import { getFeatureById } from '../constants/features';
import { baseFontSizes } from '../constants/typography';
import { INITIAL_CHOICES } from '../data/initialChoices';
import { useSettings } from '../hooks/useSettings';
import {
  buildAssistantHistoryText,
  getAiConnectionBanner,
  requestConsultation,
  shouldOfferGuidanceStart,
  type ConsultHistoryTurn,
  type GuidanceAction,
  type SafetyAction,
} from '../services/ai';
import {
  applyOcrConfirmation,
  assembleConsultationSendText,
  clearOcrAutofill,
  createEmptyOcrInputState,
  type OcrInputState,
} from '../services/ocr/consultationText';
import {
  buildPhoneSearchPayload,
  extractPhoneCandidates,
  looksLikeMessageInquiry,
  looksLikePhoneInquiry,
} from '../services/security';
import { speak, stopSpeaking } from '../services/speech';
import type { AiResponse } from '../types/ai';
import type { ConsultationChoice } from '../types/consultation';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Consultation'>;

function toChoiceItems(labels: string[]): ConsultationChoice[] {
  return labels.map((label, index) => ({
    id: `dynamic-${index}-${label}`,
    label,
  }));
}

export function ConsultationScreen({ navigation, route }: Props) {
  const { featureId } = route.params;
  const feature = getFeatureById(featureId);
  const initialChoices = useMemo(() => INITIAL_CHOICES[featureId], [featureId]);
  const localConnection = useMemo(() => getAiConnectionBanner(), []);
  const { fontSize, settings } = useSettings();

  const [ocrInput, setOcrInput] = useState<OcrInputState>(
    createEmptyOcrInputState(),
  );
  const [choices, setChoices] = useState<ConsultationChoice[]>(initialChoices);
  const [choicesAreDynamic, setChoicesAreDynamic] = useState(false);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<AiResponse | null>(null);
  const [history, setHistory] = useState<ConsultHistoryTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [showPhoneConsent, setShowPhoneConsent] = useState(false);

  const inputText = ocrInput.inputText;
  const isGuiding = lastResponse?.status === 'guiding';
  const isExplained = lastResponse?.status === 'explained';
  const isSafetyResult = lastResponse?.status === 'safety_result';
  const canOfferStart =
    lastResponse !== null && shouldOfferGuidanceStart(featureId, lastResponse);

  // Firebase 公開設定があっても Gemini 未設定（mode=offline）なら接続済みと出さない
  const connection = useMemo(() => {
    if (lastResponse?.mode === 'offline') {
      return {
        connected: false,
        message:
          lastResponse.message?.trim() ||
          'AI未接続です。基本の選択肢をご利用ください',
      };
    }
    return localConnection;
  }, [lastResponse, localConnection]);

  const canStart =
    assembleConsultationSendText(inputText).length > 0 ||
    selectedChoiceId !== null;

  useEffect(() => {
    return () => {
      void stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (!isGuiding || !lastResponse?.voiceText) {
      return;
    }
    if (!settings.voiceEnabled) {
      return;
    }
    void speak({
      text: lastResponse.voiceText,
      rate: settings.speechRate,
      language: 'ja-JP',
    }).catch(() => {
      // 音声失敗でも画面案内は続ける
    });
  }, [
    isGuiding,
    lastResponse?.currentStep,
    lastResponse?.displayText,
    lastResponse?.voiceText,
    lastResponse?.question,
    settings.voiceEnabled,
    settings.speechRate,
  ]);

  const playVoice = async (voiceText: string) => {
    if (!settings.voiceEnabled) {
      return;
    }
    try {
      await speak({
        text: voiceText,
        rate: settings.speechRate,
        language: 'ja-JP',
      });
    } catch {
      // 音声失敗でも画面案内は続ける
    }
  };

  const handleOcrConfirmed = (payload: ConfirmedOcrPayload) => {
    // 確認・編集済みテキストだけを入力欄へ。生の OCR 結果は受け取らない。
    setOcrInput((prev) => applyOcrConfirmation(prev, payload.text));
    if (featureId === 'safetyCheck') {
      const phones = extractPhoneCandidates(payload.text);
      if (phones.length > 0) {
        setPhoneDraft(phones[0].display);
        setShowPhoneConsent(true);
      }
    }
  };

  const handleOcrCleared = () => {
    // OCR 自動投入分だけ消し、利用者が別に書いた文は残す
    setOcrInput((prev) => clearOcrAutofill(prev));
  };

  const handleInputChange = (text: string) => {
    setOcrInput((prev) => ({ ...prev, inputText: text }));
  };

  const applyResponse = (
    response: AiResponse,
    userSummary: string,
  ) => {
    setLastResponse(response);
    setHistory((prev) => [
      ...prev,
      { role: 'user', text: userSummary },
      {
        role: 'assistant',
        text: buildAssistantHistoryText(response),
      },
    ]);

    if (response.status === 'guiding') {
      setSelectedChoiceId(null);
      return;
    }

    if (response.status === 'explained' || response.status === 'safety_result') {
      setSelectedChoiceId(null);
      if (response.choices && response.choices.length > 0) {
        setChoices(toChoiceItems(response.choices));
        setChoicesAreDynamic(true);
      }
      return;
    }

    if (response.choices && response.choices.length > 0) {
      setChoices(toChoiceItems(response.choices));
      setChoicesAreDynamic(true);
      setSelectedChoiceId(null);
      setOcrInput(createEmptyOcrInputState());
    }
  };

  const handleStart = async () => {
    if (!canStart || busy) {
      return;
    }

    const choiceLabel = choices.find((c) => c.id === selectedChoiceId)?.label;
    if (
      choiceLabel === '最初の選択肢に戻る' ||
      choiceLabel === '別のことで相談する' ||
      choiceLabel === '別の文章を解説する' ||
      choiceLabel === '別の内容を確認する' ||
      choiceLabel === '別の番号を調べる' ||
      choiceLabel === '別の文章を確認する'
    ) {
      handleResetChoices();
      return;
    }

    const guidanceAction = resolveChoiceGuidanceAction(choiceLabel);

    // 実送信パス：入力欄の最終文字列のみ（OCR 生データ・位置ヒント・画像なし）
    const textForAi = assembleConsultationSendText(inputText);

    // 安全性検査: 電話番号は同意 UI を挟む（番号だけを後で送る）
    if (
      featureId === 'safetyCheck' &&
      !guidanceAction &&
      looksLikePhoneInquiry(textForAi, choiceLabel) &&
      !looksLikeMessageInquiry(textForAi, choiceLabel)
    ) {
      const phones = extractPhoneCandidates(textForAi);
      setPhoneDraft(phones[0]?.display || textForAi.trim());
      setShowPhoneConsent(true);
      setSelectedChoiceId(null);
      return;
    }

    let safetyAction: SafetyAction | undefined;
    if (featureId === 'safetyCheck' && looksLikeMessageInquiry(textForAi, choiceLabel)) {
      safetyAction = 'message_analyze';
    }

    const userSummary = [choiceLabel, textForAi].filter(Boolean).join(' / ');

    setBusy(true);
    try {
      const response = await requestConsultation({
        featureId,
        text: textForAi,
        choiceLabel,
        history,
        guidanceAction,
        safetyAction,
      });
      applyResponse(response, userSummary || textForAi || choiceLabel || '');
      if (
        response.voiceText &&
        (response.status === 'explained' || response.status === 'safety_result')
      ) {
        void playVoice(response.voiceText);
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePhoneSearch = async () => {
    if (busy) {
      return;
    }
    const payload = buildPhoneSearchPayload(phoneDraft);
    if (payload.length < 10) {
      return;
    }

    setBusy(true);
    try {
      const response = await requestConsultation({
        featureId: 'safetyCheck',
        text: payload,
        choiceLabel: '電話番号の公開情報調査',
        history,
        safetyAction: 'phone_search',
        searchConsent: true,
      });
      setShowPhoneConsent(false);
      applyResponse(response, `電話番号調査（同意済み）: ${payload}`);
      if (response.voiceText) {
        void playVoice(response.voiceText);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGuidanceAction = async (action: GuidanceAction) => {
    if (busy || !isGuiding) {
      return;
    }

    // 確認済み OCR テキストがあれば次ステップの文脈として送る（画像・生OCR・位置ヒントは送らない）
    const screenContext = assembleConsultationSendText(inputText);
    const label =
      action === 'done'
        ? 'できました'
        : action === 'simplify'
          ? '分かりません'
          : '案内を始める';

    setBusy(true);
    try {
      const response = await requestConsultation({
        featureId,
        text: screenContext,
        choiceLabel: label,
        history,
        guidanceAction: action,
      });
      applyResponse(
        response,
        screenContext ? `${label} / ${screenContext}` : label,
      );
      if (action === 'done' || action === 'simplify') {
        // 次の案内用に OCR 自動投入はクリア（利用者の独自文は clear しない）
        setOcrInput((prev) => clearOcrAutofill(prev));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleStartGuidance = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const response = await requestConsultation({
        featureId,
        text: '',
        choiceLabel: '案内を始める',
        history,
        guidanceAction: 'start',
      });
      applyResponse(response, '案内を始める');
    } finally {
      setBusy(false);
    }
  };

  const handleResetChoices = () => {
    void stopSpeaking();
    setChoices(initialChoices);
    setChoicesAreDynamic(false);
    setSelectedChoiceId(null);
    setLastResponse(null);
    setHistory([]);
    setOcrInput(createEmptyOcrInputState());
    setShowPhoneConsent(false);
    setPhoneDraft('');
  };

  const resultBody = buildResultBody(lastResponse);
  const showScreenshotHint =
    featureId === 'operationSupport' ||
    featureId === 'textExplanation' ||
    featureId === 'safetyCheck';

  const inputLabel =
    featureId === 'textExplanation'
      ? '解説したい文章'
      : featureId === 'safetyCheck'
        ? '確認したい番号・文章'
        : '困っていること';

  const inputPlaceholder =
    featureId === 'textExplanation'
      ? '例：写真へのアクセスを許可しますか？'
      : featureId === 'safetyCheck'
        ? '例：09012345678 または SMSの文章'
        : '例：LINEの通知が来ない';

  return (
    <Screen>
      <AppHeader
        title={feature.title}
        showBack
        onPressBack={() => navigation.goBack()}
      />

      <Text style={[styles.lead, { fontSize: fontSize(baseFontSizes.body) }]}>
        {isGuiding
          ? '次の操作を一つだけ行ってください。画面の文字を取り込むこともできます。'
          : showScreenshotHint
            ? '文章を書くか、スクリーンショットから文字を取り込むか、下の選択肢を押してください。'
            : '文章を書くか、下の選択肢を押してください。'}
      </Text>

      <InfoCard message={connection.message} />

      <ScreenshotOcrPanel
        onConfirmed={handleOcrConfirmed}
        onCleared={handleOcrCleared}
      />

      {isGuiding && lastResponse ? (
        <>
          <TextInputField
            label="画面から読み取った文字（任意）"
            value={inputText}
            onChangeText={handleInputChange}
            placeholder="確認した文字があれば残せます（画像は送りません）"
          />
          <GuidanceStepPanel
            response={lastResponse}
            busy={busy}
            onDone={() => {
              void handleGuidanceAction('done');
            }}
            onSimplify={() => {
              void handleGuidanceAction('simplify');
            }}
            onExit={handleResetChoices}
          />
        </>
      ) : (
        <>
          <TextInputField
            label={inputLabel}
            value={inputText}
            onChangeText={handleInputChange}
            placeholder={inputPlaceholder}
          />

          {showPhoneConsent ? (
            <SafetyPhoneConsentPanel
              phoneNumber={phoneDraft}
              onChangePhoneNumber={setPhoneDraft}
              busy={busy}
              onSearch={() => {
                void handlePhoneSearch();
              }}
              onCancel={() => setShowPhoneConsent(false)}
            />
          ) : null}

          <View style={styles.choicesHeader}>
            <Text
              style={[
                styles.sectionTitle,
                { fontSize: fontSize(baseFontSizes.bodyLarge) },
              ]}
            >
              {choicesAreDynamic ? 'おすすめの選択肢' : 'よくある相談'}
            </Text>
            <Text
              style={[
                styles.sectionHint,
                { fontSize: fontSize(baseFontSizes.caption) },
              ]}
            >
              {choicesAreDynamic
                ? '内容に合わせて選択肢が変わりました。'
                : connection.connected
                  ? '相談を送ると、内容に合わせて選択肢が変わります。'
                  : 'AI未接続のため、基本の選択肢を表示しています。'}
            </Text>
          </View>

          <View style={styles.choices}>
            {choices.map((choice) => (
              <ChoiceButton
                key={choice.id}
                label={choice.label}
                selected={selectedChoiceId === choice.id}
                onPress={() => setSelectedChoiceId(choice.id)}
              />
            ))}
          </View>

          <PrimaryButton
            label={busy ? '考えています…' : 'この内容で進む'}
            onPress={() => {
              void handleStart();
            }}
            disabled={!canStart || busy}
          />

          {canOfferStart ? (
            <PrimaryButton
              label={busy ? '考えています…' : '案内を始める'}
              onPress={() => {
                void handleStartGuidance();
              }}
              disabled={busy}
            />
          ) : null}

          {choicesAreDynamic ? (
            <PrimaryButton
              label="最初の選択肢に戻る"
              variant="secondary"
              onPress={handleResetChoices}
              disabled={busy}
            />
          ) : null}

          {isExplained && lastResponse?.explanation ? (
            <ExplanationResultPanel response={lastResponse} />
          ) : null}

          {isSafetyResult && lastResponse ? (
            <SafetyResultPanel response={lastResponse} />
          ) : null}

          {!isExplained && !isSafetyResult && resultBody ? (
            <View style={styles.result}>
              {lastResponse?.mode === 'demo' ||
              lastResponse?.mode === 'offline' ? (
                <Text
                  style={[
                    styles.modeLabel,
                    { fontSize: fontSize(baseFontSizes.caption) },
                  ]}
                >
                  {lastResponse.mode === 'demo' ? 'デモ案内' : 'AI未接続'}
                </Text>
              ) : null}
              <Text
                style={[
                  styles.resultText,
                  { fontSize: fontSize(baseFontSizes.body) },
                ]}
              >
                {resultBody}
              </Text>
              {lastResponse?.recommendedActions &&
              lastResponse.recommendedActions.length > 0 ? (
                <View style={styles.actions}>
                  {lastResponse.recommendedActions.map((action) => (
                    <Text
                      key={action}
                      style={[
                        styles.actionItem,
                        { fontSize: fontSize(baseFontSizes.body) },
                      ]}
                    >
                      ・{action}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function resolveChoiceGuidanceAction(
  choiceLabel: string | undefined,
): GuidanceAction | undefined {
  if (!choiceLabel) {
    return undefined;
  }
  if (
    choiceLabel === '案内を始める' ||
    choiceLabel === 'もう一度最初から案内する'
  ) {
    return 'start';
  }
  return undefined;
}

function buildResultBody(response: AiResponse | null): string | null {
  if (!response) {
    return null;
  }

  // guiding / explained / safety_result は専用パネルで表示する
  if (
    response.status === 'guiding' ||
    response.status === 'explained' ||
    response.status === 'safety_result'
  ) {
    return null;
  }

  const parts = [
    response.displayText,
    response.message,
    response.question,
  ].filter((part): part is string => Boolean(part && part.trim()));

  if (parts.length === 0) {
    return '返事を表示できませんでした。もう一度お試しください。';
  }

  const unique: string[] = [];
  for (const part of parts) {
    if (!unique.includes(part)) {
      unique.push(part);
    }
  }
  return unique.join('\n\n');
}

const styles = StyleSheet.create({
  lead: {
    color: colors.textSecondary,
    lineHeight: 28,
  },
  choicesHeader: {
    gap: 6,
    marginTop: 4,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '700',
  },
  sectionHint: {
    color: colors.textMuted,
    lineHeight: 26,
  },
  choices: {
    gap: 12,
  },
  result: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  modeLabel: {
    color: colors.primary,
    fontWeight: '700',
  },
  resultText: {
    color: colors.text,
    lineHeight: 28,
  },
  actions: {
    gap: 6,
  },
  actionItem: {
    color: colors.textSecondary,
    lineHeight: 28,
  },
});
