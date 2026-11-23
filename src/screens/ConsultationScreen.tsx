import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSpeechRecognitionEvent } from 'expo-speech-recognition';

import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { TextInputField } from '../components/TextInputField';
import { colors } from '../constants/colors';
import { getFeatureById } from '../constants/features';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';
import { classifyIntent, isOnDeviceAiReady } from '../services/onDeviceAi';
import {
  safetyModeSummary,
  type SafetyInspectMode,
} from '../services/security';
import {
  abortSpeechRecognition,
  getSpeechRecognitionAvailability,
  startSpeechRecognition,
  stopSpeechRecognition,
  transcriptFromResultEvent,
} from '../services/speech/recognition';
import type { RootStackParamList } from '../types/navigation';
import { navigateToSupportSession } from '../utils/navigateToSupport';

type Props = NativeStackScreenProps<RootStackParamList, 'Consultation'>;

type InputMethod = 'pick' | 'text' | 'voice';

/**
 * 相談開始: 操作支援／文章説明は「文字／音声」の2択。
 * 安全性チェックは「電話／メール」を先に選び、そのあと支援へ。
 * 端末内 AI 未接続時は明示デモ判定。
 */
export function ConsultationScreen({ navigation, route }: Props) {
  const { featureId, presetText } = route.params;
  const feature = getFeatureById(featureId);
  const { fontSize } = useSettings();
  const isSafety = featureId === 'safetyCheck';

  const [method, setMethod] = useState<InputMethod>(() =>
    presetText?.trim() ? 'text' : 'pick',
  );
  const [inputText, setInputText] = useState(presetText ?? '');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState(() => {
    const availability = getSpeechRecognitionAvailability();
    return availability.usable ? '' : availability.detail;
  });

  useSpeechRecognitionEvent('start', () => {
    setListening(true);
  });
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
  });
  useSpeechRecognitionEvent('result', (event) => {
    const next = transcriptFromResultEvent(event);
    if (next) {
      setInputText(next);
    }
  });
  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    const message = event.message?.trim();
    setVoiceHint(
      message && message.length > 0
        ? `聞き取りできませんでした。文字で直せます。（${message}）`
        : '聞き取りできませんでした。文字で直せます。',
    );
  });

  useEffect(() => {
    return () => {
      abortSpeechRecognition();
    };
  }, []);

  const proceed = async (text: string) => {
    if (busy) {
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    setBusy(true);
    abortSpeechRecognition();
    try {
      const result = await classifyIntent({ featureId, text: trimmed });

      if (result.clarity === 'unclear') {
        navigation.navigate('AiChoice', {
          featureId,
          text: trimmed,
          clarifyRound: 1,
        });
        return;
      }

      navigateToSupportSession(navigation, {
        featureId,
        summary: trimmed,
      });
    } finally {
      setBusy(false);
    }
  };

  const startSafetyMode = (mode: SafetyInspectMode) => {
    if (busy) {
      return;
    }
    navigateToSupportSession(navigation, {
      featureId: 'safetyCheck',
      summary: safetyModeSummary(mode),
    });
  };

  const canSubmit = inputText.trim().length > 0 && !busy;
  const demoHint = !isOnDeviceAiReady();

  const goPick = () => {
    abortSpeechRecognition();
    setListening(false);
    setMethod('pick');
  };

  const startListening = () => {
    void (async () => {
      const result = await startSpeechRecognition();
      if (!result.ok) {
        setVoiceHint(result.detail);
        setListening(false);
        return;
      }
      setVoiceHint('話してください。終わったら「聞き取りを止める」を押します。');
    })();
  };

  const stopListening = () => {
    stopSpeechRecognition();
    setListening(false);
    setVoiceHint('文字を確認して、直してから進んでください。');
  };

  const inputLabel =
    featureId === 'textExplanation'
      ? '説明したい文章'
      : featureId === 'safetyCheck'
        ? '確認したいこと'
        : '困っていること';

  const inputPlaceholder =
    featureId === 'textExplanation'
      ? '例：写真へのアクセスを許可しますか？'
      : featureId === 'safetyCheck'
        ? '例：知らない番号から電話があった'
        : '例：LINEの通知が来ない';

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        title={feature.title}
        showBack
        onPressBack={() => {
          if (method === 'pick') {
            navigation.goBack();
            return;
          }
          goPick();
        }}
      />

      {demoHint ? (
        <Text
          style={[styles.demoHint, { fontSize: fontSize(baseFontSizes.caption) }]}
          numberOfLines={1}
        >
          AI未接続・デモ判定
        </Text>
      ) : null}

      {method === 'pick' && isSafety ? (
        <>
          <Text
            style={[styles.lead, { fontSize: fontSize(baseFontSizes.title) }]}
            numberOfLines={2}
            accessibilityRole="header"
          >
            何を確認しますか？
          </Text>
          <Text
            style={[
              styles.safetyHint,
              { fontSize: fontSize(baseFontSizes.caption) },
            ]}
            numberOfLines={2}
          >
            電話かメールを選んだあと、その画面の文字だけを調べます。勝手に他の画面は見ません。
          </Text>
          <View style={styles.methodActions}>
            <PrimaryButton
              label="電話"
              onPress={() => startSafetyMode('phone')}
              disabled={busy}
            />
            <PrimaryButton
              label="メール"
              variant="secondary"
              onPress={() => startSafetyMode('email')}
              disabled={busy}
            />
          </View>
        </>
      ) : null}

      {method === 'pick' && !isSafety ? (
        <>
          <Text
            style={[styles.lead, { fontSize: fontSize(baseFontSizes.title) }]}
            numberOfLines={2}
            accessibilityRole="header"
          >
            どうやって伝えますか？
          </Text>
          <View style={styles.methodActions}>
            <PrimaryButton
              label="文字で入力"
              onPress={() => setMethod('text')}
            />
            <PrimaryButton
              label="音声で入力"
              variant="secondary"
              onPress={() => {
                const availability = getSpeechRecognitionAvailability();
                setVoiceHint(
                  availability.usable ? '' : availability.detail,
                );
                setMethod('voice');
              }}
            />
          </View>
        </>
      ) : null}

      {method === 'text' ? (
        <>
          <Text
            style={[styles.lead, { fontSize: fontSize(baseFontSizes.title) }]}
            numberOfLines={2}
            accessibilityRole="header"
          >
            困っていることを書いてください
          </Text>
          <View style={styles.inputBlock}>
            <TextInputField
              label={inputLabel}
              value={inputText}
              onChangeText={setInputText}
              placeholder={inputPlaceholder}
            />
          </View>
          <PrimaryButton
            label={busy ? '確認しています…' : 'この内容で進む'}
            onPress={() => {
              void proceed(inputText);
            }}
            disabled={!canSubmit}
          />
        </>
      ) : null}

      {method === 'voice' ? (
        <>
          <Text
            style={[styles.lead, { fontSize: fontSize(baseFontSizes.title) }]}
            numberOfLines={2}
            accessibilityRole="header"
          >
            話してください。あとで文字を直せます
          </Text>
          {voiceHint ? (
            <Text
              style={[
                styles.voiceHint,
                { fontSize: fontSize(baseFontSizes.caption) },
              ]}
              numberOfLines={2}
            >
              {voiceHint}
            </Text>
          ) : null}
          <PrimaryButton
            label={listening ? '聞き取りを止める' : 'マイクで話す'}
            onPress={() => {
              if (listening) {
                stopListening();
                return;
              }
              startListening();
            }}
            disabled={busy}
          />
          <View style={styles.inputBlock}>
            <TextInputField
              label="聞き取った文字（直せます）"
              value={inputText}
              onChangeText={setInputText}
              placeholder="ここに文字が出ます"
              compact
            />
          </View>
          <PrimaryButton
            label={busy ? '確認しています…' : 'この内容で進む'}
            onPress={() => {
              void proceed(inputText);
            }}
            disabled={!canSubmit}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
  },
  lead: {
    color: colors.text,
    fontWeight: '700',
    lineHeight: 34,
  },
  demoHint: {
    color: colors.primary,
    fontWeight: '700',
  },
  safetyHint: {
    color: colors.textSecondary,
    lineHeight: 22,
  },
  methodActions: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    minHeight: 0,
  },
  inputBlock: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
  },
  voiceHint: {
    color: colors.textSecondary,
    lineHeight: 24,
  },
});
