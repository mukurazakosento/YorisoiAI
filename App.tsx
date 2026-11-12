import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from './src/constants/colors';
import { SettingsProvider, useSettings } from './src/hooks/useSettings';
import { RootNavigator } from './src/navigation/RootNavigator';
import { configureNotificationHandler } from './src/services/notifications';
import { initOnDeviceAi } from './src/services/onDeviceAi';

function AppReady() {
  const { isReady } = useSettings();

  useEffect(() => {
    configureNotificationHandler();
    // フラグOFFや WebGPU 無しならすぐ AI未接続（デモ）。成功したふりをしない。
    void initOnDeviceAi();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <RootNavigator />
      <StatusBar style="dark" />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AppReady />
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
