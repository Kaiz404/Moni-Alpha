import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
  type Theme,
} from "expo-router/react-navigation";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";
import "react-native-reanimated";
import { useUniwind } from "uniwind";

import "../global.css";

import { AuthGuard } from "@/components/auth-guard";
import { FabReceiptProcessingOverlay } from "@/components/receipt/fab-receipt-processing-overlay";
import { ProposalSummarySheet } from "@/components/proposal-summary-sheet";
import { StoreSyncActivator } from "@/components/store-sync-activator";
import { useThemeTokens } from "@/hooks/use-theme-tokens";
import { AuthProvider } from "@/lib/auth/auth-context";
import { getPendingCount } from "@/lib/ai/processing-queue";
import { startBackgroundProcessor } from "@/lib/ai/background-processor";
import { QueryProvider } from "@/lib/query/query-client";
import { drainImageUploadQueue } from "@/lib/receipts/upload-queue";
import { pruneIncompleteProposals } from "@/lib/supabase/proposed-transactions";
import { applyStoredThemePreference } from "@/lib/theme/preference";

applyStoredThemePreference();

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const { theme } = useUniwind();
  const tokens = useThemeTokens();
  const processorAppState = useRef(AppState.currentState);
  const uploadAppState = useRef(AppState.currentState);

  const navigationTheme = useMemo<Theme>(() => {
    const base = theme === "dark" ? DarkTheme : DefaultTheme;
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

    const sub = AppState.addEventListener("change", (nextState) => {
      if (processorAppState.current.match(/inactive|background/) && nextState === "active") {
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

    const sub = AppState.addEventListener("change", (nextState) => {
      if (uploadAppState.current.match(/inactive|background/) && nextState === "active") {
        drainImageUploadQueue().catch(() => {});
      }
      uploadAppState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  return (
    <QueryProvider>
      <ThemeProvider value={navigationTheme}>
        <AuthProvider>
          <StoreSyncActivator />
          <AuthGuard>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
            <FabReceiptProcessingOverlay />
            <ProposalSummarySheet />
          </AuthGuard>
          <StatusBar style={theme === "dark" ? "light" : "dark"} />
        </AuthProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
