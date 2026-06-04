import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { DMSans_400Regular, DMSans_600SemiBold } from '@expo-google-fonts/dm-sans';
import { useTranslation } from 'react-i18next';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { initDb } from './src/storage/database';
import { initI18n } from './src/i18n';
import { WorkoutProvider } from './src/context/WorkoutContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { colors as defaultColors } from './src/theme';
import OnboardingScreen, { ONBOARDING_KEY } from './src/screens/OnboardingScreen';

import HomeScreen from './src/screens/HomeScreen';
import WorkoutScreen from './src/screens/WorkoutScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import StatsScreen from './src/screens/StatsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

function TabIcon({ label }: { label: string }) {
  return <Text style={{ fontSize: 18 }}>{label}</Text>;
}

function TabNavigator() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ title: t('home'), tabBarIcon: () => <TabIcon label="🏠" /> }}
      />
      <Tab.Screen
        name="WorkoutTab"
        component={WorkoutScreen}
        options={{ title: t('workout'), tabBarIcon: () => <TabIcon label="⚡" /> }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryScreen}
        options={{ title: t('historyTab'), tabBarIcon: () => <TabIcon label="📋" /> }}
      />
      <Tab.Screen
        name="StatsTab"
        component={StatsScreen}
        options={{ title: t('statsTab'), tabBarIcon: () => <TabIcon label="📊" /> }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{ title: t('settingsTab'), tabBarIcon: () => <TabIcon label="⚙️" /> }}
      />
    </Tab.Navigator>
  );
}

function AppInner() {
  const { i18n } = useTranslation();
  if (!i18n.isInitialized) return null;
  return (
    <NavigationContainer>
      <TabNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [i18nReady, setI18nReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    DMSans_400Regular,
    DMSans_600SemiBold,
  });

  useEffect(() => {
    Notifications.requestPermissionsAsync().catch(() => {});

    initI18n()
      .then(() => setI18nReady(true))
      .catch(e => setInitError('i18n: ' + e?.message));

    initDb()
      .then(() => setDbReady(true))
      .catch(e => setInitError('db: ' + e?.message));

    AsyncStorage.getItem(ONBOARDING_KEY)
      .then(v => setOnboarded(v === '1'))
      .catch(() => setOnboarded(false));
  }, []);

  if (initError) {
    return (
      <View style={{ flex: 1, backgroundColor: defaultColors.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ color: defaultColors.danger, fontSize: 14, textAlign: 'center' }}>
          Startup error:{'\n'}{initError}
        </Text>
      </View>
    );
  }

  if (!dbReady || !i18nReady || !fontsLoaded || onboarded === null) {
    return (
      <View style={{ flex: 1, backgroundColor: defaultColors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={defaultColors.accent} size="large" />
        <Text style={{ color: defaultColors.muted, marginTop: 16, fontSize: 13 }}>
          {!fontsLoaded ? 'Loading fonts…' : !i18nReady ? 'Loading language…' : 'Loading database…'}
        </Text>
      </View>
    );
  }

  if (onboarded === false) {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <OnboardingScreen onDone={() => setOnboarded(true)} />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <WorkoutProvider>
          <AppInner />
        </WorkoutProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
