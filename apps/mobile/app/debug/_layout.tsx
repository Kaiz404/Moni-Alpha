import { Stack } from 'expo-router';

export default function DebugLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Debug' }} />
    </Stack>
  );
}
