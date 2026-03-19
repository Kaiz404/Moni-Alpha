import { Stack } from 'expo-router';

export default function WalletLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="new" options={{ title: 'New Wallet', headerShown: false }} />
    </Stack>
  );
}
