import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from '@expo-google-fonts/instrument-sans';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { ChoiceSheetHost } from './src/components/ChoiceSheet';
import { PushRouting } from './src/navigation/PushRouting';
import { navigationRef } from './src/navigation/ref';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { isApiError } from './src/api/client';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { AnimatedSplash } from './src/features/auth/AnimatedSplash';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useColors } from './src/theme/ThemeProvider';
import { UndoProvider } from './src/undo/UndoProvider';

SplashScreen.preventAutoHideAsync();

// Coming back to the app counts as focus: what is on screen refreshes if it is older than staleTime.
AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Do not hammer the server for answers that will not change.
      retry: (count, error) => !(isApiError(error) && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
    InstrumentSerif_400Regular,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <ThemeProvider>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <BottomSheetModalProvider>
                  <Root fontsReady={fontsLoaded || !!fontError} />
                  <ChoiceSheetHost />
                </BottomSheetModalProvider>
              </AuthProvider>
            </QueryClientProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Root({ fontsReady }: { fontsReady: boolean }) {
  const colors = useColors();
  const { status } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [navReady, setNavReady] = useState(false);
  const ready = fontsReady && status !== 'loading';

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.ground).catch(() => {});
  }, [colors.ground]);

  const navTheme = useMemo<Theme>(() => {
    const base = colors.scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.brand,
        background: colors.ground,
        card: colors.panel,
        text: colors.ink,
        border: colors.line,
        notification: colors.tabBar.badge,
      },
    };
  }, [colors]);

  return (
    <View style={styles.fill}>
      <StatusBar style={!splashDone ? 'light' : colors.scheme === 'dark' ? 'light' : 'dark'} />
      {ready ? (
        <UndoProvider>
          <NavigationContainer ref={navigationRef} theme={navTheme} onReady={() => setNavReady(true)}>
            <RootNavigator />
          </NavigationContainer>
          <PushRouting navigationReady={navReady} />
        </UndoProvider>
      ) : (
        <View style={[styles.fill, { backgroundColor: colors.ground }]} />
      )}
      {splashDone ? null : <AnimatedSplash ready={ready} onDone={() => setSplashDone(true)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
