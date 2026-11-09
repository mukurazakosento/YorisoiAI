import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

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
import { SPEECH_MUTE_HELP, stopSpeaking } from '../services/speech';
import { SPEECH_RATE_OPTIONS } from '../types/settings';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { settings, updateSettings, fontSize } = useSettings();

  return (
    <Screen>
      <AppHeader
        title="設定"
        showBack
        onPressBack={() => navigation.goBack()}
      />

      <SettingOptionRow
        title="音声案内"
        description="オンにすると、操作案内・文章解説・安全性検査の詳しい説明を声で読みます。オフでも画面の文字は表示されます。"
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

      <Text style={[styles.muteHelp, { fontSize: fontSize(baseFontSizes.caption) }]}>
        {SPEECH_MUTE_HELP}
      </Text>

      <SettingOptionRow
        title="読み上げ速度"
        description="最初は「ややゆっくり」です。聞き取りやすい速さに変えられます。"
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

      <View style={styles.links}>
        <PrimaryButton
          label="個人情報の取り扱いについて"
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
  muteHelp: {
    color: colors.textMuted,
    lineHeight: 26,
    marginTop: -4,
  },
  links: {
    gap: 12,
    marginTop: 8,
  },
});
