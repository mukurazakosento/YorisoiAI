import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { FeatureButton } from '../components/FeatureButton';
import { Screen } from '../components/Screen';
import { colors } from '../constants/colors';
import { FEATURES } from '../constants/features';
import { baseFontSizes } from '../constants/typography';
import { useSettings } from '../hooks/useSettings';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { fontSize } = useSettings();

  return (
    <Screen>
      <AppHeader
        showSettings
        onPressSettings={() => navigation.navigate('Settings')}
      />

      <Text
        style={[styles.lead, { fontSize: fontSize(baseFontSizes.body) }]}
        accessibilityRole="text"
      >
        困っていることを選んでください。
      </Text>

      <View style={styles.list}>
        {FEATURES.map((feature) => (
          <FeatureButton
            key={feature.id}
            title={feature.title}
            description={feature.description}
            onPress={() =>
              navigation.navigate('Consultation', { featureId: feature.id })
            }
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: {
    color: colors.textSecondary,
    lineHeight: 28,
    marginTop: 8,
  },
  list: {
    gap: 16,
    marginTop: 4,
  },
});
