import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
  type Theme,
} from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useUniwind } from 'uniwind';

import '../global.css';

import { AuthGuard } from '@/components/providers/auth-guard';
import { ReviewNotificationTaps } from '@/components/review/notification-taps';
import { StoreSyncActivator } from '@/components/providers/store-sync-activator';
import { SheetHost } from '@/components/ui/sheet/sheet-host';
import { textFonts } from '@/components/ui/text';
import { ToastHost } from '@/components/ui/toast';
import { useCaptureRetry } from '@/hooks/use-capture-retry';
import {
  ThemeTokensContext,
  useResolvedThemeTokens,
} from '@/hooks/use-theme-tokens';
import { AuthProvider } from '@/lib/auth/auth-context';
import { QueryProvider } from '@/lib/query/query-client';
import { drainImageUploadQueue } from '@/lib/receipts/upload-queue';
import { pruneIncompleteProposals } from '@/lib/supabase/proposed-transactions';
import { pruneReviewHistoryDaily } from '@/lib/proposals/review-history';
import { applyStoredThemePreference } from '@/lib/theme/preference';
import { useThemeCommit } from '@/lib/theme/theme-commit';
import { prepareOfflineSpeechModel } from '@/lib/speech/speech-recognition';

applyStoredThemePreference();
void SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const { theme } = useUniwind();
  const reduceMotion = useReducedMotion();
  const tokens = useResolvedThemeTokens();
  const [fontsLoaded, fontError] = useFonts(textFonts);
  const fontsSettled = fontsLoaded || fontError !== null;
  const uploadAppState = useRef(AppState.currentState);

  const navigationTheme = useMemo<Theme>(() => {
    const base = theme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: tokens.primary,
        background: tokens.background,
        card: tokens.background,
        text: tokens.foreground,
        border: tokens.border,
        notification: tokens.danger,
      },
      fonts: {
        regular: {
          fontFamily: 'FunnelDisplay_400Regular',
          fontWeight: '400',
        },
        medium: {
          fontFamily: 'FunnelDisplay_600SemiBold',
          fontWeight: '600',
        },
        bold: {
          fontFamily: 'FunnelDisplay_700Bold',
          fontWeight: '700',
        },
        heavy: {
          fontFamily: 'FunnelDisplay_700Bold',
          fontWeight: '700',
        },
      },
    };
  }, [theme, tokens]);

  useThemeCommit(theme);
  useCaptureRetry();

  // Drain pending image uploads whenever the app comes to foreground
  useEffect(() => {
    pruneIncompleteProposals().catch(() => {});
    pruneReviewHistoryDaily();
    drainImageUploadQueue().catch(() => {});
    prepareOfflineSpeechModel().catch(() => {});

    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        uploadAppState.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        pruneReviewHistoryDaily();
        drainImageUploadQueue().catch(() => {});
        prepareOfflineSpeechModel().catch(() => {});
      }
      uploadAppState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (fontsSettled) void SplashScreen.hideAsync();
  }, [fontsSettled]);

  if (!fontsSettled) return null;

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <ThemeTokensContext value={tokens}>
        <SafeAreaProvider>
          <QueryProvider>
            <ThemeProvider value={navigationTheme}>
              <AuthProvider>
                <StoreSyncActivator />
                <AuthGuard>
                  <Stack
                    screenOptions={{
                      // A theme change recolours every mounted screen, so hidden ones wait until they show.
                      freezeOnBlur: true,
                      headerShown: false,
                      animation: reduceMotion
                        ? 'fade'
                        : 'slide_from_right',
                    }}
                  >
                    <Stack.Screen
                      name="(auth)"
                      options={{ animation: 'fade' }}
                    />
                    <Stack.Screen
                      name="(tabs)"
                      options={{ animation: 'fade' }}
                    />
                  </Stack>
                  <SheetHost />
                  <ReviewNotificationTaps />
                </AuthGuard>
                <ToastHost />
                <StatusBar
                  style={theme === 'dark' ? 'light' : 'dark'}
                />
              </AuthProvider>
            </ThemeProvider>
          </QueryProvider>
        </SafeAreaProvider>
      </ThemeTokensContext>
    </GestureHandlerRootView>
  );
}
