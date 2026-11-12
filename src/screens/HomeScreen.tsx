import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { FeatureButton } from '../components/FeatureButton';
import { Screen } from '../components/Screen';
import { FEATURES } from '../constants/features';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

/**
 * ホーム: 左「よりそいAI」／右設定／3ボタンのみ。フッターなし・スクロールなし。
 */
export function HomeScreen({ navigation }: Props) {
  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        brandLeft
        showSettings
        onPressSettings={() => navigation.navigate('Settings')}
      />

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
  content: {
    gap: 12,
  },
  list: {
    flex: 1,
    gap: 14,
    paddingTop: 8,
    paddingBottom: 8,
  },
});
