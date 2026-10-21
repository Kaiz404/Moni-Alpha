import { Stack } from 'expo-router';

export default function TransactionLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        options={{ title: 'Transactions' }}
      />
      <Stack.Screen
        name="new"
        options={{ title: 'New Transaction' }}
      />
      <Stack.Screen
        name="[id]"
        options={{ title: 'Edit Transaction' }}
      />
    </Stack>
  );
}
