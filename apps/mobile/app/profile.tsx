import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { router, useFocusEffect } from 'expo-router';
import { Page } from '@/components/ui/page';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import { SyncStatus } from '@/components/providers/sync-status';
import { DefaultWalletPicker } from '@/components/profile/default-wallet-picker';
import { PermissionColumn } from '@/components/profile/permission-column';
import { ProfileSectionTitle } from '@/components/profile/profile-section-title';
import { ThemePreferencePicker } from '@/components/profile/theme-preference-picker';
import { GradientCard } from '@/components/ui/gradient-card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { NavRow } from '@/components/ui/nav-row';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useNotificationListener } from '@/hooks/use-notification-listener';
import { useAuth } from '@/lib/auth/auth-context';
import { prepareOfflineSpeechModel } from '@/lib/speech/speech-recognition';
import { tid } from '@/lib/test-ids';

const avatarStyle = getWalletCardStyle('emerald-grain');

function mapSpeechPermissionStatus(result: {
  granted: boolean;
  status?: string;
}) {
  if (result.granted) return 'granted';
  if (
    result.status === 'denied' ||
    result.status === 'undetermined'
  ) {
    return result.status;
  }
  return 'undetermined';
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
      const result =
        await Location.requestForegroundPermissionsAsync();
      setLocationStatus(result.status);
    } finally {
      setIsRequestingLocation(false);
    }
  }, []);

  const requestCameraAccess = useCallback(async () => {
    setIsRequestingCamera(true);
    try {
      const result =
        await ImagePicker.requestCameraPermissionsAsync();
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
    <Page
      screen="profile"
      kind="pushed"
      title="Profile"
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-12"
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5">
          <View className="rounded-card bg-accent-aqua/30 p-4 overflow-hidden">
            <View className="flex-row items-center">
              {user &&
              user.user_metadata &&
              user.user_metadata.avatar_url ? (
                <Image
                  source={{ uri: user.user_metadata.avatar_url }}
                  className="h-14 w-14 rounded-2xl"
                  alt="User profile picture"
                />
              ) : (
                <GradientCard
                  cardStyle={avatarStyle}
                  className="h-14 w-14 items-center justify-center rounded-2xl"
                >
                  <Text className="text-2xl font-display-bold text-primary-foreground">
                    {userInitial}
                  </Text>
                </GradientCard>
              )}
              <View className="ml-3 flex-1">
                <Text className="text-[13px] font-display-semibold text-muted">
                  Your Moni account
                </Text>
                <Text
                  className="mt-0.5 text-[17px] font-display-bold text-foreground"
                  numberOfLines={2}
                >
                  {user?.email ?? 'Not signed in'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View className="mt-8 px-5">
          <ProfileSectionTitle>
            Accounts & wallets
          </ProfileSectionTitle>
          <SyncStatus className="mb-4 rounded-[22px]" />
          <DefaultWalletPicker />
        </View>

        <View className="mt-6 px-5">
          <ProfileSectionTitle>Money setup</ProfileSectionTitle>
          <ListCard>
            <NavRow
              testID={tid('profile', 'row', 'Categories')}
              icon="shape-outline"
              tint="lilac"
              title="Categories"
              onPress={() => router.push('/categories' as never)}
            />
            <NavRow
              testID={tid('profile', 'row', 'Category budgets')}
              icon="wallet"
              tint="mint"
              title="Category budgets"
              onPress={() => router.push('/budget/list')}
            />
            <NavRow
              testID={tid('profile', 'row', 'Debts')}
              icon="account-group-outline"
              tint="aqua"
              title="Debts"
              onPress={() => router.dismissTo('/debts')}
            />
          </ListCard>
        </View>

        <View className="mt-6 px-5">
          <ProfileSectionTitle>Capture sources</ProfileSectionTitle>
          <ListCard>
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
                onAction={
                  !isAuthorized ? requestPermission : undefined
                }
                actionDisabled={isCheckingPermission}
                icon="bell-badge"
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
              onAction={
                !isLocationGranted ? requestLocationAccess : undefined
              }
              actionDisabled={isRequestingLocation}
              icon="map-marker"
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
              onAction={
                !isCameraGranted ? requestCameraAccess : undefined
              }
              actionDisabled={isRequestingCamera}
              icon="camera"
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
          </ListCard>
        </View>

        <View className="mt-6 px-5">
          <ProfileSectionTitle>Appearance</ProfileSectionTitle>
          <ThemePreferencePicker />
        </View>

        <View className="mt-6 px-5">
          <ProfileSectionTitle>
            Privacy & local data
          </ProfileSectionTitle>
          <ListCard>
            <NavRow
              testID={tid('profile', 'row', 'Captured notifications')}
              icon="bell-outline"
              tint="lilac"
              title="Captured notifications"
              onPress={() => router.push('/notifications' as never)}
            />
          </ListCard>
        </View>

        <View className="mt-6 px-5">
          <ProfileSectionTitle>Developer</ProfileSectionTitle>
          <ListCard>
            <NavRow
              testID={tid('profile', 'row', 'Debug panel')}
              icon="bug-outline"
              tint="sand"
              title="Debug panel"
              onPress={() => router.push('/debug' as never)}
            />
          </ListCard>
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
            <Text className="ml-2 text-base font-display-bold text-danger">
              Sign out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Page>
  );
}
