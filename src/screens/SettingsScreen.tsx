import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { SettingOptionRow } from '../components/SettingOptionRow';
import { colors } from '../constants/colors';
import {
  baseFontSizes,
  fontScaleLabels,
  type FontScaleKey,
} from '../constants/typography';
import { useSettings } from '../hooks/useSettings';
import {
  isAndroidDialogAccessibilityEnabled,
  openAndroidDialogAccessibilitySettings,
} from '../services/androidAssist/dialogAccessibility';
import {
  ANDROID_NATIVE_MODEL,
  MODEL_CONSENT_EXPLAIN_JA,
  getOnDeviceAiBanner,
  initOnDeviceAi,
} from '../services/onDeviceAi';
import { SPEECH_MUTE_HELP, stopSpeaking } from '../services/speech';
import { SPEECH_RATE_OPTIONS } from '../types/settings';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { settings, updateSettings, fontSize } = useSettings();
  const [a11yOn, setA11yOn] = useState(false);
  const [aiBanner, setAiBanner] = useState(getOnDeviceAiBanner());
  const [llmBusy, setLlmBusy] = useState(false);
  const [llmNote, setLlmNote] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'android') {
        setA11yOn(isAndroidDialogAccessibilityEnabled());
      }
      setAiBanner(getOnDeviceAiBanner());
    }, []),
  );

  const tryInstallOnDeviceModel = async () => {
    if (Platform.OS !== 'android' || llmBusy) {
      return;
    }
    setLlmBusy(true);
    setLlmNote(null);
    try {
      const llm = await import('yorisoi-on-device-llm');
      if (!llm.isNativeOnDeviceLlmLinked()) {
        setLlmNote('このビルドでは端末内AIを入れられません（EAS Androidが必要）。');
        return;
      }
      llm.setNativeLlmDownloadConsent(true);
      const status = llm.getNativeLlmStatus();
      if (!status.storageOk && !status.modelPresent) {
        setLlmNote('空き容量が足りません（約550MB＋余裕）。');
        return;
      }
      if (!status.modelPresent) {
        setLlmNote('モデルをダウンロードしています…中断は再実行で再開できます。');
        await llm.startNativeLlmDownload();
      }
      await llm.loadNativeLlmModel();
      await initOnDeviceAi({ force: true });
      setAiBanner(getOnDeviceAiBanner());
      setLlmNote(
        aiBanner.connected || getOnDeviceAiBanner().connected
          ? '端末内AIの準備ができました。'
          : 'モデルはありますが接続確認に失敗しました（AI未接続のまま）。',
      );
    } catch (e) {
      setLlmNote(
        e instanceof Error
          ? e.message
          : '端末内AIの準備に失敗しました（AI未接続）。',
      );
    } finally {
      setLlmBusy(false);
      setAiBanner(getOnDeviceAiBanner());
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        title="設定"
        showBack
        onPressBack={() => navigation.goBack()}
      />

      <View style={styles.body}>
        <SettingOptionRow
          title="音声案内"
          description="オフでも画面の文字は残ります。"
          options={[
            { label: 'オン', value: true },
            { label: 'オフ', value: false },
          ]}
          selectedValue={settings.voiceEnabled}
          onSelect={(value) => {
            const enabled = Boolean(value);
            if (!enabled) {
              void stopSpeaking();
            }
            void updateSettings({ voiceEnabled: enabled });
          }}
        />

        <SettingOptionRow
          title="読み上げ速度"
          description="聞きやすい速さに変えられます。"
          options={SPEECH_RATE_OPTIONS.map((option) => ({
            label: option.label,
            value: option.value,
          }))}
          selectedValue={settings.speechRate}
          onSelect={(value) => {
            void updateSettings({ speechRate: Number(value) });
          }}
        />

        <SettingOptionRow
          title="文字サイズ"
          description="見やすい大きさに変えられます。"
          options={(Object.keys(fontScaleLabels) as FontScaleKey[]).map((key) => ({
            label: fontScaleLabels[key],
            value: key,
          }))}
          selectedValue={settings.fontScale}
          onSelect={(value) => {
            void updateSettings({ fontScale: value as FontScaleKey });
          }}
        />

        <Text
          style={[styles.hint, { fontSize: fontSize(baseFontSizes.caption) }]}
          numberOfLines={2}
        >
          {SPEECH_MUTE_HELP}
        </Text>
      </View>

      <View style={styles.links}>
        {Platform.OS === 'android' ? (
          <>
            <Text
              style={[styles.a11yHint, { fontSize: fontSize(baseFontSizes.caption) }]}
              numberOfLines={2}
            >
              {aiBanner.connected
                ? aiBanner.message
                : `${ANDROID_NATIVE_MODEL.displayName}（約550MB・${ANDROID_NATIVE_MODEL.license}）。${MODEL_CONSENT_EXPLAIN_JA.slice(0, 36)}…`}
            </Text>
            {!aiBanner.connected ? (
              <PrimaryButton
                label={llmBusy ? '端末内AIを準備中…' : '端末内AIモデルに同意して入れる'}
                variant="secondary"
                onPress={() => {
                  void tryInstallOnDeviceModel();
                }}
              />
            ) : null}
            {llmNote ? (
              <Text
                style={[styles.a11yHint, { fontSize: fontSize(baseFontSizes.caption) }]}
                numberOfLines={2}
              >
                {llmNote}
              </Text>
            ) : null}
          </>
        ) : null}
        {Platform.OS === 'android' ? (
          <PrimaryButton
            label={
              a11yOn
                ? 'ポップアップ自動解説：オン'
                : 'ポップアップ自動解説を設定'
            }
            variant="secondary"
            onPress={() => {
              void openAndroidDialogAccessibilitySettings()
                .then(() => {
                  setA11yOn(isAndroidDialogAccessibilityEnabled());
                })
                .catch(() => {
                  // Settings unavailable
                });
            }}
          />
        ) : null}
        {Platform.OS === 'android' ? (
          <Text
            style={[styles.a11yHint, { fontSize: fontSize(baseFontSizes.caption) }]}
            numberOfLines={2}
          >
            一度オンにすると、アプリを閉じても許可画面を通知と音声で説明します（自動タップなし）。
          </Text>
        ) : null}
        <PrimaryButton
          label="個人情報の取り扱い"
          variant="secondary"
          onPress={() => navigation.navigate('Privacy')}
        />
        <PrimaryButton
          label="アプリについて"
          variant="secondary"
          onPress={() => navigation.navigate('About')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 10,
  },
  body: {
    flex: 1,
    gap: 10,
    minHeight: 0,
  },
  hint: {
    color: colors.textMuted,
    lineHeight: 22,
  },
  links: {
    gap: 8,
  },
  a11yHint: {
    color: colors.textMuted,
    lineHeight: 20,
  },
});
