import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/auth/auth-context';
import { PowerSyncStatus } from '@/components/power-sync-status';
import { useNotificationListener } from '@/hooks/use-notification-listener';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { permissionStatus, isCheckingPermission, requestPermission } = useNotificationListener();
  const [locationStatus, setLocationStatus] = useState<Location.PermissionStatus | null>(null);
  const [cameraStatus, setCameraStatus] = useState<ImagePicker.PermissionStatus | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const isAndroid = Platform.OS === 'android';
  const isAuthorized = permissionStatus === 'authorized';
  const isLocationGranted = locationStatus === 'granted';
  const isCameraGranted = cameraStatus === 'granted';

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login' as any);
  };

  const openNotifications = useCallback(() => {
    router.push('/notifications' as any);
  }, []);

  const openDebugPanel = useCallback(() => {
    router.push('/debug' as any);
  }, []);

  const refreshPermissionStatus = useCallback(async () => {
    const [locationPerm, cameraPerm] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      ImagePicker.getCameraPermissionsAsync(),
    ]);
    setLocationStatus(locationPerm.status);
    setCameraStatus(cameraPerm.status);
  }, []);

  useEffect(() => {
    refreshPermissionStatus().catch(() => {});
  }, [refreshPermissionStatus]);

  const requestLocationAccess = useCallback(async () => {
    setIsRequestingLocation(true);
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(result.status);
    } finally {
      setIsRequestingLocation(false);
    }
  }, []);

  const requestCameraAccess = useCallback(async () => {
    setIsRequestingCamera(true);
    try {
      const result = await ImagePicker.requestCameraPermissionsAsync();
      setCameraStatus(result.status);
    } finally {
      setIsRequestingCamera(false);
    }
  }, []);

  const labelForStatus = (status: string | null) => {
    if (status === 'granted') return 'Enabled';
    if (status === 'denied') return 'Denied';
    if (status === 'undetermined') return 'Not requested';
    return 'Unknown';
  };

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

      <View className="mb-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <Text className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Location access</Text>
        <Text className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Status: {labelForStatus(locationStatus)}
        </Text>
        {!isLocationGranted && (
          <TouchableOpacity
            className="bg-blue-600 dark:bg-blue-500 px-4 py-2.5 rounded-lg self-start"
            onPress={requestLocationAccess}
            disabled={isRequestingLocation}>
            <Text className="text-white font-semibold text-sm">
              {isRequestingLocation ? 'Requesting…' : 'Enable location'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View className="mb-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <Text className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Camera access</Text>
        <Text className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Status: {labelForStatus(cameraStatus)}
        </Text>
        {!isCameraGranted && (
          <TouchableOpacity
            className="bg-blue-600 dark:bg-blue-500 px-4 py-2.5 rounded-lg self-start"
            onPress={requestCameraAccess}
            disabled={isRequestingCamera}>
            <Text className="text-white font-semibold text-sm">
              {isRequestingCamera ? 'Requesting…' : 'Enable camera'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        className="mb-3 bg-gray-100 dark:bg-gray-800 p-3.5 rounded-lg items-center border border-gray-200 dark:border-gray-700"
        onPress={openDebugPanel}>
        <Text className="text-gray-900 dark:text-white text-base font-semibold">Open Debug Panel</Text>
      </TouchableOpacity>

      <TouchableOpacity className="bg-red-500 dark:bg-red-600 p-3.5 rounded-lg items-center" onPress={handleSignOut}>
        <Text className="text-white text-base font-semibold">Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

