import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import { SyncStatus } from '@/components/providers/sync-status';
import { DefaultWalletPicker } from '@/components/profile/default-wallet-picker';
import { PermissionColumn } from '@/components/profile/permission-column';
import { ProfileSectionTitle } from '@/components/profile/profile-section-title';
import { SettingsRow } from '@/components/profile/settings-row';
import { ThemePreferencePicker } from '@/components/profile/theme-preference-picker';
import { GradientCard } from '@/components/ui/gradient-card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Surface } from '@/components/ui/surface';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useNotificationListener } from '@/hooks/use-notification-listener';
import { useAuth } from '@/lib/auth/auth-context';
import { prepareOfflineSpeechModel } from '@/lib/speech/speech-recognition';

const avatarStyle = getWalletCardStyle('emerald-grain');

function mapSpeechPermissionStatus(result: {
  granted: boolean;
  status?: string;
}) {
  if (result.granted) return 'granted';
  if (result.status === 'denied' || result.status === 'undetermined') {
    return result.status;
  }
  return 'undetermined';
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <Surface className="overflow-hidden rounded-[22px]">{children}</Surface>
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const tokens = useThemeTokens();
  const {
    permissionStatus,
    isCheckingPermission,
    requestPermission,
    checkPermission,
  } = useNotificationListener();
  const [locationStatus, setLocationStatus] =
    useState<Location.PermissionStatus | null>(null);
  const [cameraStatus, setCameraStatus] =
    useState<ImagePicker.PermissionStatus | null>(null);
  const [micStatus, setMicStatus] = useState<string | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] =
    useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [isRequestingMic, setIsRequestingMic] = useState(false);

  const isAndroid = Platform.OS === 'android';
  const isAuthorized = permissionStatus === 'authorized';
  const isLocationGranted = locationStatus === 'granted';
  const isCameraGranted = cameraStatus === 'granted';
  const isMicGranted = micStatus === 'granted';

  useFocusEffect(
    useCallback(() => {
      checkPermission();
    }, [checkPermission]),
  );

  const userInitial = useMemo(() => {
    const ch = (user?.email ?? '').charAt(0).toUpperCase();
    return ch || '?';
  }, [user?.email]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login' as any);
  };

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
    void refreshPermissionStatus();
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
      const result =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
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
    return 'Checking access';
  };

  return (
    <SafeAreaView
      edges={['top']}
      className="flex-1 bg-canvas"
      style={{ flex: 1 }}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-12"
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pb-5 pt-6">
          <Text className="text-[28px] font-bold leading-[34px] text-foreground">
            Profile
          </Text>
          <Text className="mt-1 text-[15px] leading-5 text-muted">
            Shape how Moni works for you.
          </Text>
        </View>

        <View className="px-5">
          <Surface className="p-4">
            <View className="flex-row items-center">
              <GradientCard
                cardStyle={avatarStyle}
                className="h-14 w-14 items-center justify-center rounded-2xl"
              >
                <Text className="text-2xl font-bold text-primary-foreground">
                  {userInitial}
                </Text>
              </GradientCard>
              <View className="ml-3 flex-1">
                <Text className="text-[13px] font-semibold text-muted">
                  Your Moni account
                </Text>
                <Text
                  className="mt-0.5 text-[17px] font-bold text-foreground"
                  numberOfLines={2}
                >
                  {user?.email ?? 'Not signed in'}
                </Text>
              </View>
            </View>
            <Text className="mt-3 text-[13px] leading-[17px] text-muted">
              Your data stays available locally while Moni synchronizes when
              a connection is available.
            </Text>
          </Surface>
        </View>

        <View className="mt-8 px-5">
          <ProfileSectionTitle>Accounts & wallets</ProfileSectionTitle>
          <SyncStatus className="mb-4 rounded-[22px] border border-border" />
          <Text className="mb-3 text-[13px] leading-[17px] text-muted">
            Choose the wallet Moni should use when a receipt, message, or
            notification does not identify one.
          </Text>
          <DefaultWalletPicker />
        </View>

        <View className="mt-6 px-5">
          <ProfileSectionTitle>Money setup</ProfileSectionTitle>
          <SettingsGroup>
            <SettingsRow
              icon="account-balance-wallet"
              iconBgClassName="bg-primary-muted"
              iconColor={tokens.primary}
              title="Category budgets"
              subtitle="Set monthly caps per category and currency"
              onPress={() => router.push('/budget' as any)}
            />
            <SettingsRow
              icon="group"
              iconBgClassName="bg-accent-aqua/40"
              iconColor={tokens.transfer}
              title="Debts"
              subtitle="Track what you owe and what others owe you"
              onPress={() => router.push('/debts' as any)}
              showDivider={false}
            />
          </SettingsGroup>
        </View>

        <View className="mt-6 px-5">
          <ProfileSectionTitle>Capture sources</ProfileSectionTitle>
          <Text className="mb-3 text-[13px] leading-[17px] text-muted">
            Permissions make scanning, voice capture, and linked bank alerts
            available. You can change them any time.
          </Text>
          <SettingsGroup>
            {!isAndroid ? (
              <PermissionColumn
                title="Notification access"
                statusLabel="Android only"
                icon="notifications-off"
                iconTint={tokens.surface2}
                muted
                showAction={false}
                widthClassName=""
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
                        ? 'Checking access'
                        : 'Off'
                }
                granted={isAuthorized}
                actionLabel={
                  !isAuthorized
                    ? isCheckingPermission
                      ? 'Checking'
                      : 'Enable'
                    : undefined
                }
                onAction={!isAuthorized ? requestPermission : undefined}
                actionDisabled={isCheckingPermission}
                icon="notifications-active"
                iconTint={tokens.accents.lilac}
                showAction={!isAuthorized}
                widthClassName="border-b border-border-subtle"
              />
            )}
            <PermissionColumn
              title="Location"
              statusLabel={labelForStatus(locationStatus)}
              granted={isLocationGranted}
              actionLabel={
                !isLocationGranted
                  ? isRequestingLocation
                    ? 'Checking'
                    : 'Enable'
                  : undefined
              }
              onAction={!isLocationGranted ? requestLocationAccess : undefined}
              actionDisabled={isRequestingLocation}
              icon="location-on"
              iconTint={tokens.accents.aqua}
              showAction={!isLocationGranted}
              widthClassName="border-b border-border-subtle"
            />
            <PermissionColumn
              title="Camera"
              statusLabel={labelForStatus(cameraStatus)}
              granted={isCameraGranted}
              actionLabel={
                !isCameraGranted
                  ? isRequestingCamera
                    ? 'Checking'
                    : 'Enable'
                  : undefined
              }
              onAction={!isCameraGranted ? requestCameraAccess : undefined}
              actionDisabled={isRequestingCamera}
              icon="photo-camera"
              iconTint={tokens.accents.peach}
              showAction={!isCameraGranted}
              widthClassName="border-b border-border-subtle"
            />
            <PermissionColumn
              title="Microphone"
              statusLabel={labelForStatus(micStatus)}
              granted={isMicGranted}
              actionLabel={
                !isMicGranted
                  ? isRequestingMic
                    ? 'Checking'
                    : 'Enable'
                  : undefined
              }
              onAction={!isMicGranted ? requestMicAccess : undefined}
              actionDisabled={isRequestingMic}
              icon="mic"
              iconTint={tokens.accents.lilac}
              showAction={!isMicGranted}
              widthClassName=""
            />
          </SettingsGroup>
        </View>

        <View className="mt-6 px-5">
          <ProfileSectionTitle>Appearance</ProfileSectionTitle>
          <ThemePreferencePicker />
        </View>

        <View className="mt-6 px-5">
          <ProfileSectionTitle>Privacy & local data</ProfileSectionTitle>
          <SettingsGroup>
            <SettingsRow
              icon="notifications"
              iconBgClassName="bg-accent-lilac/40"
              iconColor={tokens.states.pending}
              title="Captured notifications"
              subtitle="Review the alerts Moni has stored on this device"
              onPress={() => router.push('/notifications' as any)}
              showDivider={false}
            />
          </SettingsGroup>
        </View>

        <View className="mt-6 px-5">
          <ProfileSectionTitle>Developer</ProfileSectionTitle>
          <SettingsGroup>
            <SettingsRow
              icon="bug-report"
              iconBgClassName="bg-surface-2"
              iconColor={tokens.muted}
              title="Debug panel"
              subtitle="Diagnostics and developer tools"
              onPress={() => router.push('/debug' as any)}
              showDivider={false}
            />
          </SettingsGroup>
        </View>

        <View className="mt-8 px-5">
          <TouchableOpacity
            className="min-h-13 flex-row items-center justify-center rounded-2xl bg-danger/10 px-4 py-3.5"
            onPress={handleSignOut}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <IconSymbol
              name="logout"
              size={20}
              color={tokens.danger}
            />
            <Text className="ml-2 text-base font-bold text-danger">
              Sign out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
