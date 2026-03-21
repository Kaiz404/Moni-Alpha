import { Stack } from 'expo-router';

export default function NotificationsLayout() {
  return (
    <Stack>
      <Stack.Screen name="push-notifications" options={{ title: 'Push Notifications', headerShown: false }} />
    </Stack>
  );
}
