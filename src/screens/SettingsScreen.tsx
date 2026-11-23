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
import { SPEECH_MUTE_HELP, stopSpeaking } from '../services/speech';
import { SPEECH_RATE_OPTIONS } from '../types/settings';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { settings, updateSettings, fontSize } = useSettings();
  const [a11yOn, setA11yOn] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'android') {
        setA11yOn(isAndroidDialogAccessibilityEnabled());
      }
    }, []),
  );

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
