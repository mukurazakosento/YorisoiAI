import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AboutScreen } from '../screens/AboutScreen';
import { AiChoiceScreen } from '../screens/AiChoiceScreen';
import { ConsultationScreen } from '../screens/ConsultationScreen';
import { EndSupportScreen } from '../screens/EndSupportScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { PrivacyScreen } from '../screens/PrivacyScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SupportSessionScreen } from '../screens/SupportSessionScreen';
import type { RootStackParamList } from '../types/navigation';
import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: '#F7FAFC' },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Consultation" component={ConsultationScreen} />
        <Stack.Screen name="AiChoice" component={AiChoiceScreen} />
        <Stack.Screen name="SupportSession" component={SupportSessionScreen} />
        <Stack.Screen name="EndSupport" component={EndSupportScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Privacy" component={PrivacyScreen} />
        <Stack.Screen name="About" component={AboutScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
