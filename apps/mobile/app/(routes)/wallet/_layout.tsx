import { Stack } from 'expo-router';

export default function WalletLayout() {
  return (
    <Stack>
      <Stack.Screen name="new" options={{ title: 'New Wallet', headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Edit Wallet', headerShown: false }} />
    </Stack>
  );
}
