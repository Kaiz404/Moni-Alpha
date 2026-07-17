import { Stack, router } from 'expo-router';
import { Pressable, View } from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { SyncStatusIndicator } from '@/components/providers/sync-status-indicator';

export default function TransactionLayout() {
  const tokens = useThemeTokens();

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Transactions',
          headerShown: true,
          headerStyle: { backgroundColor: tokens.background },
          headerTintColor: tokens.foreground,
          headerShadowVisible: true,
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              className="ml-1 p-1 active:opacity-70"
            >
              <MaterialIcons
                name="arrow-back"
                size={24}
                color={tokens.foreground}
              />
            </Pressable>
          ),
          headerRight: () => (
            <View className="mr-2">
              <SyncStatusIndicator />
            </View>
          ),
        }}
      />
      <Stack.Screen
        name="new"
        options={{ title: 'New Transaction', headerShown: false }}
      />
      <Stack.Screen
        name="new-details"
        options={{ title: 'More Details', headerShown: false }}
      />
      <Stack.Screen
        name="[id]"
        options={{ title: 'Edit Transaction', headerShown: false }}
      />
    </Stack>
  );
}
