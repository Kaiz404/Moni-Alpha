import { router, Stack } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { Button } from '@/components/ui/button';
import { tid } from '@/lib/test-ids';
import { Page } from '@/components/ui/page';

export default function NotFoundScreen() {
  const tokens = useThemeTokens();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Page
        screen="nav"
        kind="bare"
      >
        <View className="flex-1 items-center justify-center px-5">
          <View className="rounded-card bg-card w-full max-w-md items-center p-6">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-primary-muted">
              <IconSymbol
                name="compass-off-outline"
                size={26}
                color={tokens.primary}
              />
            </View>
            <Text className="text-center text-[22px] font-display-bold text-foreground">
              This screen moved
            </Text>
            <Button
              testID={tid('nav', 'go-to-home')}
              label="Go to Home"
              className="mt-6 w-full"
              onPress={() => router.replace('/(tabs)' as any)}
            />
          </View>
        </View>
      </Page>
    </>
  );
}
