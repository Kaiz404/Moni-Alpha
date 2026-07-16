import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  ScrollView,
} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { prepareOfflineSpeechModel } from '@/lib/speech/speech-recognition';
import { useAuth } from '@/lib/auth/auth-context';
import { SyncStatus } from '@/components/providers/sync-status';
import { ThemePreferencePicker } from '@/components/profile/theme-preference-picker';
import { DefaultWalletPicker } from '@/components/profile/default-wallet-picker';
import { PermissionColumn } from '@/components/profile/permission-column';
import { ProfileSectionTitle } from '@/components/profile/profile-section-title';
import { SettingsRow } from '@/components/profile/settings-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useNotificationListener } from '@/hooks/use-notification-listener';
import { GradientCard } from '@/components/ui/gradient-card';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';

const avatarStyle = getWalletCardStyle('emerald-grain');

function mapSpeechPermissionStatus(result: { granted: boolean; status?: string }) {
  if (result.granted) return 'granted';
  if (result.status === 'denied' || result.status === 'undetermined') return result.status;
  return 'undetermined';
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const tokens = useThemeTokens();
  const { permissionStatus, isCheckingPermission, requestPermission, checkPermission } =
    useNotificationListener();
  const [locationStatus, setLocationStatus] = useState<Location.PermissionStatus | null>(null);
  const [cameraStatus, setCameraStatus] = useState<ImagePicker.PermissionStatus | null>(null);
  const [micStatus, setMicStatus] = useState<string | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const isAndroid = Platform.OS === 'android';
  const isAuthorized = permissionStatus === 'authorized';

  useFocusEffect(
    useCallback(() => {
      checkPermission();
    }, [checkPermission]),
  );
  const isLocationGranted = locationStatus === 'granted';
  const isCameraGranted = cameraStatus === 'granted';
  const isMicGranted = micStatus === 'granted';

  const userInitial = useMemo(() => {
    const email = user?.email ?? '';
    const ch = email.charAt(0).toUpperCase();
    return ch || '?';
  }, [user?.email]);

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

  const openBudgets = useCallback(() => {
    router.push('/budget' as any);
  }, []);

  const refreshPermissionStatus = useCallback(async () => {
    const [locationPerm, cameraPerm, micPerm] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      ImagePicker.getCameraPermissionsAsync(),
      ExpoSpeechRecognitionModule.getPermissionsAsync(),
    ]);
    setLocationStatus(locationPerm.status);
    setCameraStatus(cameraPerm.status);
    setMicStatus(mapSpeechPermissionStatus(micPerm));
  }, []);

  useEffect(() => {
    refreshPermissionStatus().catch(() => { });
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

  const requestMicAccess = useCallback(async () => {
    setIsRequestingMic(true);
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setMicStatus(mapSpeechPermissionStatus(result));
      if (result.granted) {
        await prepareOfflineSpeechModel({ allowDialog: true });
      }
    } finally {
      setIsRequestingMic(false);
    }
  }, []);

  const labelForStatus = (status: string | null) => {
    if (status === 'granted') return 'Enabled';
    if (status === 'denied') return 'Denied';
    if (status === 'undetermined') return 'Not requested';
    return 'Unknown';
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow pb-10"
        showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-6 pb-4">
          <Text className="text-2xl font-bold text-foreground">Profile</Text>
        </View>

        <View className="px-4 pb-4">
          <View className="overflow-hidden rounded-3xl border border-border bg-card p-4">
            <View className="flex-row items-center">
              <GradientCard cardStyle={avatarStyle} className="h-14 w-14 items-center justify-center rounded-2xl">
                <Text className="text-2xl font-bold text-white">{userInitial}</Text>
              </GradientCard>
              <View className="ml-3 flex-1 min-w-0">
                <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Signed in
                </Text>
                {user?.email ? (
                  <Text className="mt-0.5 text-base font-bold text-foreground" numberOfLines={2}>
                    {user.email}
                  </Text>
                ) : (
                  <Text className="mt-0.5 text-base font-semibold text-muted">Not signed in</Text>
                )}
              </View>
            </View>
            <Text className="mt-3 text-xs text-muted">
              Manage sync, permissions, and account settings below.
            </Text>
          </View>
        </View>

        <View className="px-4 pt-2 pb-6">
          <ProfileSectionTitle>Sync</ProfileSectionTitle>
          <SyncStatus className="mb-4 rounded-2xl border border-border" />

          <ProfileSectionTitle>Permissions</ProfileSectionTitle>
          <Text className="mb-3 text-xs text-muted">
            Grant access so Moni can read bank/wallet alerts (Android notification access), use
            location, scan receipts, and use voice input in chat.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {!isAndroid ? (
              <PermissionColumn
                title="Notifications"
                statusLabel="Android only"
                icon="notifications-off"
                iconTint="#94a3b8"
                muted
                showAction={false}
                widthClassName="w-[48%]"
              />
            ) : (
              <PermissionColumn
                title="Notification access"
                statusLabel={
                  isAuthorized
                    ? 'Enabled'
                    : permissionStatus === 'denied'
                      ? 'Off'
                      : isCheckingPermission
                        ? 'Checking…'
                        : 'Off'
                }
                granted={isAuthorized}
                actionLabel={
                  !isAuthorized
                    ? isCheckingPermission
                      ? '…'
                      : 'Open settings'
                    : undefined
                }
                onAction={!isAuthorized ? requestPermission : undefined}
                actionDisabled={isCheckingPermission}
                icon="notifications-active"
                iconTint={tokens.primary}
                showAction={!isAuthorized}
                widthClassName="w-[48%]"
              />
            )}
            <PermissionColumn
              title="Location"
              statusLabel={labelForStatus(locationStatus)}
              granted={isLocationGranted}
              actionLabel={
                !isLocationGranted ? (isRequestingLocation ? '…' : 'Enable') : undefined
              }
              onAction={!isLocationGranted ? requestLocationAccess : undefined}
              actionDisabled={isRequestingLocation}
              icon="location-on"
              iconTint="#0ea5e9"
              showAction={!isLocationGranted}
              widthClassName="w-[48%]"
            />
            <PermissionColumn
              title="Camera"
              statusLabel={labelForStatus(cameraStatus)}
              granted={isCameraGranted}
              actionLabel={!isCameraGranted ? (isRequestingCamera ? '…' : 'Enable') : undefined}
              onAction={!isCameraGranted ? requestCameraAccess : undefined}
              actionDisabled={isRequestingCamera}
              icon="photo-camera"
              iconTint="#6366f1"
              showAction={!isCameraGranted}
              widthClassName="w-[48%]"
            />
            <PermissionColumn
              title="Microphone"
              statusLabel={labelForStatus(micStatus)}
              granted={isMicGranted}
              actionLabel={!isMicGranted ? (isRequestingMic ? '…' : 'Enable') : undefined}
              onAction={!isMicGranted ? requestMicAccess : undefined}
              actionDisabled={isRequestingMic}
              icon="mic"
              iconTint="#a855f7"
              showAction={!isMicGranted}
              widthClassName="w-[48%]"
            />
          </View>

          <View className="mt-6">
            <ProfileSectionTitle>Appearance</ProfileSectionTitle>
            <ThemePreferencePicker />
          </View>

          <View className="mt-6">
            <ProfileSectionTitle>Default wallet</ProfileSectionTitle>
            <Text className="mb-3 text-xs text-muted">
              Used when AI cannot infer a wallet from text, receipts, or notifications.
            </Text>
            <DefaultWalletPicker />
          </View>

          <View className="mt-6">
            <ProfileSectionTitle>Shortcuts</ProfileSectionTitle>
            <SettingsRow
              icon="account-balance-wallet"
              iconBgClassName=""
              iconBgColor={tokens.primary}
              title="Category budgets"
              subtitle="Monthly caps per category (all wallets) for AI coaching"
              onPress={openBudgets}
            />
            <SettingsRow
              icon="notifications"
              iconBgClassName=""
              iconBgColor={tokens.primary}
              title="Notifications"
              subtitle="View captured notification history"
              onPress={openNotifications}
            />
            <SettingsRow
              icon="bug-report"
              iconBgClassName="bg-muted"
              title="Debug panel"
              subtitle="Diagnostics and developer tools"
              onPress={openDebugPanel}
            />
          </View>

          <TouchableOpacity
            className="mt-6 flex-row items-center justify-center rounded-2xl border border-danger/30 bg-danger/10 py-3.5"
            onPress={handleSignOut}
            activeOpacity={0.85}>
            <MaterialIcons name="logout" size={20} color={tokens.danger} />
            <Text className="ml-2 text-base font-semibold text-danger">
              Sign out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
