import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { SettingOptionRow } from '../components/SettingOptionRow';
import {
  fontScaleLabels,
  type FontScaleKey,
} from '../constants/typography';
import { useSettings } from '../hooks/useSettings';
import { SPEECH_RATE_OPTIONS } from '../types/settings';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { settings, updateSettings } = useSettings();

  return (
    <Screen>
      <AppHeader
        title="設定"
        showBack
        onPressBack={() => navigation.goBack()}
      />

      <SettingOptionRow
        title="音声案内"
        description="オンにすると、操作案内などを声で読みます。"
        options={[
          { label: 'オン', value: true },
          { label: 'オフ', value: false },
        ]}
        selectedValue={settings.voiceEnabled}
        onSelect={(value) => {
          void updateSettings({ voiceEnabled: Boolean(value) });
        }}
      />

      <SettingOptionRow
        title="読み上げ速度"
        description="ややゆっくりがおすすめです。"
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
  links: {
    gap: 12,
    marginTop: 8,
  },
});
