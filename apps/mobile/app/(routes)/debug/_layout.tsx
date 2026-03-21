import { Stack } from 'expo-router';

export default function DebugLayout() {
  return (
    <Stack>
      <Stack.Screen name="debug-model" options={{ title: 'Debug Model', headerShown: false }} />
    </Stack>
  );
}
