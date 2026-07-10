import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useAuth } from '@/lib/auth/auth-context';
import { SyncStatus } from '@/components/sync-status';
import { useNotificationListener } from '@/hooks/use-notification-listener';

function ProfileSectionTitle({ children }: { children: string }) {
  return (
    <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
      {children}
    </Text>
  );
}

function SettingsRow({
  icon,
  iconBgClassName,
  title,
  subtitle,
  onPress,
  right,
  disabled,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconBgClassName: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  right?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`mb-2 flex-row items-center rounded-xl border border-slate-300 bg-white p-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-800 active:opacity-90 ${disabled ? 'opacity-50' : ''}`}>
      <View
        className={`h-11 w-11 items-center justify-center rounded-2xl ${iconBgClassName}`}>
        <MaterialIcons name={icon} size={22} color="#fff" />
      </View>
      <View className="ml-3 flex-1 min-w-0">
        <Text className="text-base font-semibold text-slate-900 dark:text-white" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-xs text-slate-500 dark:text-slate-400" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? <MaterialIcons name="chevron-right" size={22} color="#94a3b8" />}
    </Pressable>
  );
}

function mapSpeechPermissionStatus(result: { granted: boolean; status?: string }) {
  if (result.granted) return 'granted';
  if (result.status === 'denied' || result.status === 'undetermined') return result.status;
  return 'undetermined';
}

function PermissionColumn({
  title,
  statusLabel,
  actionLabel,
  onAction,
  actionDisabled,
  icon,
  iconTint,
  muted,
  showAction,
  widthClassName = 'flex-1 min-w-0',
}: {
  title: string;
  statusLabel: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  icon: keyof typeof MaterialIcons.glyphMap;
  iconTint: string;
  muted?: boolean;
  showAction: boolean;
  /** e.g. `w-[48%]` when using a 2×2 grid */
  widthClassName?: string;
}) {
  return (
    <View
      className={`rounded-xl border border-slate-300 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${widthClassName}`}>
      <View
        className="mx-auto h-9 w-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: iconTint }}>
        <MaterialIcons name={icon} size={20} color="#fff" />
      </View>
      <Text
        className="mt-2 text-center text-xs font-semibold text-slate-900 dark:text-white"
        numberOfLines={2}>
        {title}
      </Text>
      <Text
        className="mt-1 text-center text-[10px] leading-tight text-slate-500 dark:text-slate-400"
        numberOfLines={2}>
        {statusLabel}
      </Text>
      {muted ? (
        <Text className="mt-2 text-center text-[10px] text-slate-400 dark:text-slate-500">—</Text>
      ) : showAction && actionLabel && onAction ? (
        <TouchableOpacity
          className="mt-2 rounded-lg bg-[#8494FF] px-1.5 py-2 dark:bg-[#6b74e8]"
          onPress={onAction}
          disabled={actionDisabled}
          activeOpacity={0.85}>
          <Text
            className="text-center text-[10px] font-semibold leading-tight text-white"
            numberOfLines={2}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : (
        <View className="mt-2 rounded-lg bg-emerald-500/15 py-2 dark:bg-emerald-500/20">
          <Text className="text-center text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
            On
          </Text>
        </View>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { permissionStatus, isCheckingPermission, requestPermission } = useNotificationListener();
  const [locationStatus, setLocationStatus] = useState<Location.PermissionStatus | null>(null);
  const [cameraStatus, setCameraStatus] = useState<ImagePicker.PermissionStatus | null>(null);
  const [micStatus, setMicStatus] = useState<string | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const isAndroid = Platform.OS === 'android';
  const isAuthorized = permissionStatus === 'authorized';
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
    router.push('/budget/budgets' as any);
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

  const requestMicAccess = useCallback(async () => {
    setIsRequestingMic(true);
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setMicStatus(mapSpeechPermissionStatus(result));
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
    <View className="flex-1 bg-white dark:bg-gray-900">
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow pb-10"
        showsVerticalScrollIndicator>
        <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
          <View className="flex-row items-center mt-4">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-700">
              <MaterialIcons name="person" size={22} color="#475569" />
            </View>
            <Text className="ml-3 text-2xl font-bold text-gray-900 dark:text-white">Profile</Text>
          </View>
        </View>

        <View className="px-4 pb-4">
          <View className="overflow-hidden rounded-2xl border border-indigo-200/80 bg-[#8494FF] p-4 dark:border-indigo-500/40 dark:bg-[#4f54c4]">
            <View className="flex-row items-center">
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white/25">
                <Text className="text-2xl font-bold text-white">{userInitial}</Text>
              </View>
              <View className="ml-3 flex-1 min-w-0">
                <Text className="text-xs font-semibold uppercase tracking-wide text-white/90">
                  Signed in
                </Text>
                {user?.email ? (
                  <Text className="mt-0.5 text-base font-bold text-white" numberOfLines={2}>
                    {user.email}
                  </Text>
                ) : (
                  <Text className="mt-0.5 text-base font-semibold text-white/90">Not signed in</Text>
                )}
              </View>
            </View>
            <Text className="mt-3 text-xs text-white/80">
              Manage sync, permissions, and account settings below.
            </Text>
          </View>
        </View>

        <View className="px-4 pt-2 pb-6">
          <ProfileSectionTitle>Sync</ProfileSectionTitle>
          <SyncStatus className="mb-4 border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/90 rounded-xl shadow-sm" />

          <ProfileSectionTitle>Permissions</ProfileSectionTitle>
          <Text className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Grant access so Moni can sync notifications (Android), use location, scan receipts, and use voice
            input in chat.
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
                title="Notifications"
                statusLabel={isAuthorized ? 'Enabled' : 'Off'}
                actionLabel={
                  !isAuthorized
                    ? isCheckingPermission
                      ? '…'
                      : 'Enable'
                    : undefined
                }
                onAction={!isAuthorized ? requestPermission : undefined}
                actionDisabled={isCheckingPermission}
                icon="notifications-active"
                iconTint="#8494FF"
                showAction={!isAuthorized}
                widthClassName="w-[48%]"
              />
            )}
            <PermissionColumn
              title="Location"
              statusLabel={labelForStatus(locationStatus)}
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
            <ProfileSectionTitle>Shortcuts</ProfileSectionTitle>
            <SettingsRow
              icon="account-balance-wallet"
              iconBgClassName="bg-emerald-600"
              title="Category budgets"
              subtitle="Monthly caps per category (all wallets) for AI coaching"
              onPress={openBudgets}
            />
            <SettingsRow
              icon="notifications"
              iconBgClassName="bg-[#8494FF]"
              title="Notifications"
              subtitle="View captured notification history"
              onPress={openNotifications}
            />
            <SettingsRow
              icon="bug-report"
              iconBgClassName="bg-slate-600 dark:bg-slate-500"
              title="Debug panel"
              subtitle="Diagnostics and developer tools"
              onPress={openDebugPanel}
            />
          </View>

          <TouchableOpacity
            className="mt-6 flex-row items-center justify-center rounded-xl border border-red-200 bg-red-50 py-3.5 dark:border-red-500/40 dark:bg-red-950/50"
            onPress={handleSignOut}
            activeOpacity={0.85}>
            <MaterialIcons name="logout" size={20} color="#dc2626" />
            <Text className="ml-2 text-base font-semibold text-red-600 dark:text-red-400">
              Sign out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
