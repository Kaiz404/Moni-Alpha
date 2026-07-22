import { router, Stack } from 'expo-router';
import { Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenShell } from '@/components/ui/screen-shell';
import { Surface } from '@/components/ui/surface';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

export default function NotFoundScreen() {
  const tokens = useThemeTokens();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenShell
        variant="canvas"
        edges={['top', 'bottom']}
        className="items-center justify-center px-5"
      >
        <Surface className="w-full max-w-md items-center p-6">
          <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-primary-muted">
            <IconSymbol
              name="compass-off-outline"
              size={26}
              color={tokens.primary}
            />
          </View>
          <Text className="text-center text-[22px] font-bold text-foreground">
            This screen moved
          </Text>
          <PrimaryButton
            label="Go to Home"
            className="mt-6 w-full"
            onPress={() => router.replace('/(tabs)' as any)}
          />
        </Surface>
      </ScreenShell>
    </>
  );
}
