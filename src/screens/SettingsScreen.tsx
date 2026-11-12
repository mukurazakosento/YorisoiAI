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
import { stopSpeaking } from '../services/speech';
import { SPEECH_RATE_OPTIONS } from '../types/settings';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { settings, updateSettings, fontSize } = useSettings();

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
          音が出ないときは、iPhone側面の消音スイッチと音量を確認してください。
        </Text>
      </View>

      <View style={styles.links}>
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
    gap: 10,
  },
});
