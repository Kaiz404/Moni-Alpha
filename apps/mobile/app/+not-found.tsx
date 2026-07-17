import { Link, Stack } from 'expo-router';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen
        options={{ title: 'Not found', headerShown: true }}
      />
      <SafeAreaView
        edges={['bottom']}
        className="flex-1 items-center justify-center bg-background px-6"
      >
        <Text className="mb-2 text-xl font-bold text-foreground">
          Screen not found
        </Text>
        <Text className="mb-6 text-center text-sm text-muted">
          This route does not exist or was moved.
        </Text>
        <Link
          href="/(tabs)"
          className="text-base font-semibold text-primary"
        >
          Go home
        </Link>
      </SafeAreaView>
    </>
  );
}
