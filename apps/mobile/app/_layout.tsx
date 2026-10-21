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
import { AppState } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useUniwind } from 'uniwind';

import '../global.css';

import { AuthGuard } from '@/components/providers/auth-guard';
import { FabReceiptProcessingOverlay } from '@/components/receipt/fab-receipt-processing-overlay';
import { ProposalSummarySheet } from '@/components/proposal/proposal-summary-sheet';
import { StoreSyncActivator } from '@/components/providers/store-sync-activator';
import { SheetHost } from '@/components/ui/sheet/sheet-host';
import { textFonts } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { AuthProvider } from '@/lib/auth/auth-context';
import { getPendingCount } from '@/lib/ai/processing-queue';
import { startBackgroundProcessor } from '@/lib/ai/background-processor';
import { QueryProvider } from '@/lib/query/query-client';
import { drainImageUploadQueue } from '@/lib/receipts/upload-queue';
import { pruneIncompleteProposals } from '@/lib/supabase/proposed-transactions';
import { applyStoredThemePreference } from '@/lib/theme/preference';
import { prepareOfflineSpeechModel } from '@/lib/speech/speech-recognition';

applyStoredThemePreference();
void SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const { theme } = useUniwind();
  const tokens = useThemeTokens();
  const [fontsLoaded, fontError] = useFonts(textFonts);
  const fontsSettled = fontsLoaded || fontError !== null;
  const processorAppState = useRef(AppState.currentState);
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

  const triggerProcessingIfPending = async () => {
    if (getPendingCount() > 0) {
      await startBackgroundProcessor();
    }
  };

  // Ensure queued AI work (including notifications captured in headless mode)
  // resumes automatically when the app starts or returns to foreground.
  useEffect(() => {
    triggerProcessingIfPending().catch(() => {});

    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        processorAppState.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        triggerProcessingIfPending().catch(() => {});
      }
      processorAppState.current = nextState;
    });

    return () => sub.remove();
  }, []);

  // Drain pending image uploads whenever the app comes to foreground
  useEffect(() => {
    pruneIncompleteProposals().catch(() => {});
    drainImageUploadQueue().catch(() => {});
    prepareOfflineSpeechModel().catch(() => {});

    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        uploadAppState.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
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
    <SafeAreaProvider>
      <QueryProvider>
        <ThemeProvider value={navigationTheme}>
          <AuthProvider>
            <StoreSyncActivator />
            <AuthGuard>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen
                  name="(auth)"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="(tabs)"
                  options={{ headerShown: false }}
                />
              </Stack>
              <SheetHost />
              <FabReceiptProcessingOverlay />
              <ProposalSummarySheet />
            </AuthGuard>
            <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
          </AuthProvider>
        </ThemeProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
