import { Stack } from 'expo-router';

export default function WalletLayout() {
  return (
    <Stack>
      <Stack.Screen name="new" options={{ title: 'New Wallet' }} />
    </Stack>
  );
}
