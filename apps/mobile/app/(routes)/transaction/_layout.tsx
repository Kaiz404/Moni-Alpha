import { Stack, router } from 'expo-router';
import { Pressable, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { PowerSyncStatusIndicator } from '@/components/power-sync-status-indicator';

export default function TransactionLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const headerTint = isDark ? '#f9fafb' : '#111827';
  const headerBg = isDark ? '#111827' : '#ffffff';

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Transactions',
          headerShown: true,
          headerStyle: { backgroundColor: headerBg },
          headerTintColor: headerTint,
          headerShadowVisible: true,
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              className="ml-1 p-1 active:opacity-70">
              <MaterialIcons name="arrow-back" size={24} color={headerTint} />
            </Pressable>
          ),
          headerRight: () => (
            <View className="mr-2">
              <PowerSyncStatusIndicator />
            </View>
          ),
        }}
      />
      <Stack.Screen name="new" options={{ title: 'New Transaction', headerShown: false }} />
    </Stack>
  );
}
