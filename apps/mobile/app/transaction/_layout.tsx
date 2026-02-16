import { Stack } from 'expo-router';

export default function TransactionLayout() {
  return (
    <Stack>
      <Stack.Screen name="new" options={{ title: 'New Transaction' }} />
    </Stack>
  );
}
