import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import "../global.css";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { QueryProvider } from "@/lib/query/query-client";
import { AuthProvider } from "@/lib/auth/auth-context";
import { AuthGuard } from "@/components/auth-guard";
import { StoreSyncActivator } from "@/components/store-sync-activator";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { ProposalReviewModal } from "@/components/proposal-review-modal";
import { drainImageUploadQueue } from "@/lib/receipts/upload-queue";
import { getPendingCount } from "@/lib/ai/processing-queue";
import { startBackgroundProcessor } from "@/lib/ai/background-processor";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const processorAppState = useRef(AppState.currentState);
  const uploadAppState = useRef(AppState.currentState);

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
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <StoreSyncActivator />
          <AuthGuard>
            <Stack screenOptions={{headerShown: false}}>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="modal"
                options={{ presentation: "modal", title: "Modal", headerShown: false }}
              />
              <Stack.Screen name="budgets" options={{ headerShown: false }} />
            </Stack>
            <ProposalReviewModal />
          </AuthGuard>
          <StatusBar style="auto" />
        </AuthProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
