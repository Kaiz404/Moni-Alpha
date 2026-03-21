import { useCallback } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { PowerSyncStatus } from '@/components/power-sync-status';
import { useNotificationListener } from '@/hooks/use-notification-listener';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { permissionStatus, isCheckingPermission, requestPermission } = useNotificationListener();
  const isAndroid = Platform.OS === 'android';
  const isAuthorized = permissionStatus === 'authorized';

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login' as any);
  };

  const openNotifications = useCallback(() => {
    router.push('/notifications' as any);
  }, []);

  return (
    <View className="flex-1 p-6 bg-white dark:bg-gray-900">
      <Text className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">Profile</Text>

      {user && (
        <View className="mb-6">
          <Text className="text-base text-gray-600 dark:text-gray-400">{user.email}</Text>
        </View>
      )}

      <PowerSyncStatus />

      <View className="mt-6 mb-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <Text className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
          Notification access
        </Text>
        {!isAndroid ? (
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            Notification listening is available on Android only.
          </Text>
        ) : (
          <>
            <Text className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Status: {isAuthorized ? 'Enabled' : 'Not enabled'}
            </Text>
            {!isAuthorized && (
              <TouchableOpacity
                className="bg-blue-600 dark:bg-blue-500 px-4 py-2.5 rounded-lg self-start"
                onPress={requestPermission}
                disabled={isCheckingPermission}>
                <Text className="text-white font-semibold text-sm">
                  {isCheckingPermission ? 'Checking…' : 'Enable in Settings'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      <TouchableOpacity
        className="mb-3 bg-gray-100 dark:bg-gray-800 p-3.5 rounded-lg items-center border border-gray-200 dark:border-gray-700"
        onPress={openNotifications}>
        <Text className="text-gray-900 dark:text-white text-base font-semibold">View Notifications</Text>
      </TouchableOpacity>

      <TouchableOpacity className="bg-red-500 dark:bg-red-600 p-3.5 rounded-lg items-center" onPress={handleSignOut}>
        <Text className="text-white text-base font-semibold">Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

