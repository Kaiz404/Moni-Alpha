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
import { PowersyncProvider } from "@/lib/powersync/PowersyncProvider";
import { useEffect } from "react";
import { syncSystem } from "@/lib/powersync/Powersync";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();


  useEffect(() => {
    syncSystem.init();
  }, []);

  return (
    <PowersyncProvider>
      <QueryProvider>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <AuthProvider>
            <AuthGuard>
              <Stack screenOptions={{headerShown: false}}>
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="modal"
                  options={{ presentation: "modal", title: "Modal", headerShown: false }}
                />
              </Stack>
            </AuthGuard>
          </AuthProvider>
          <StatusBar style="auto" />
        </ThemeProvider>
      </QueryProvider>
    </PowersyncProvider>
  );
}
