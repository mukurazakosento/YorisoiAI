import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { Screen } from '../components/Screen';
import { colors } from '../constants/colors';
import { baseFontSizes } from '../constants/typography';
import { PRIVACY_TEXT } from '../data/about';
import { useSettings } from '../hooks/useSettings';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Privacy'>;

export function PrivacyScreen({ navigation }: Props) {
  const { fontSize } = useSettings();

  return (
    <Screen>
      <AppHeader
        title="個人情報について"
        showBack
        onPressBack={() => navigation.goBack()}
      />
      <Text style={[styles.body, { fontSize: fontSize(baseFontSizes.body) }]}>
        {PRIVACY_TEXT}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.text,
    lineHeight: 30,
  },
});
