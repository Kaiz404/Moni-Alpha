import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import {
  openNotificationListenerSettings,
  readNotificationListenerPermission,
} from '@/lib/notifications/permission';
import { prepareOfflineSpeechModel } from '@/lib/speech/speech-recognition';

export type PhoneAccessId = 'notifications' | 'location' | 'camera' | 'microphone';

/** Capture sources wording: on, off, or not set up (never asked). */
export type AccessState = 'checking' | 'on' | 'off' | 'not_set_up' | 'unavailable';

type PermissionAnswer = { granted: boolean; status: string; canAskAgain: boolean };

type Probe = {
  read: () => Promise<PermissionAnswer>;
  ask: () => Promise<PermissionAnswer>;
};

const PROBES: Record<Exclude<PhoneAccessId, 'notifications'>, Probe> = {
  location: {
    read: Location.getForegroundPermissionsAsync,
    ask: Location.requestForegroundPermissionsAsync,
  },
  camera: {
    read: ImagePicker.getCameraPermissionsAsync,
    ask: ImagePicker.requestCameraPermissionsAsync,
  },
  microphone: {
    read: () => ExpoSpeechRecognitionModule.getPermissionsAsync(),
    ask: async () => {
      const answer = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (answer.granted) await prepareOfflineSpeechModel({ allowDialog: true });
      return answer;
    },
  },
};

function stateOf(answer: PermissionAnswer): AccessState {
  if (answer.granted) return 'on';
  return answer.status === 'undetermined' ? 'not_set_up' : 'off';
}

async function readAll(): Promise<{
  access: Record<PhoneAccessId, AccessState>;
  canAsk: Record<PhoneAccessId, boolean>;
}> {
  const [listener, location, camera, microphone] = await Promise.all([
    readNotificationListenerPermission(),
    PROBES.location.read().catch(() => null),
    PROBES.camera.read().catch(() => null),
    PROBES.microphone.read().catch(() => null),
  ]);
  const answers = { location, camera, microphone };
  const access = {
    notifications:
      listener === 'authorized'
        ? 'on'
        : listener === 'denied'
          ? 'off'
          : listener === 'unavailable'
            ? 'unavailable'
            : 'checking',
  } as Record<PhoneAccessId, AccessState>;
  const canAsk = { notifications: false } as Record<PhoneAccessId, boolean>;
  for (const id of ['location', 'camera', 'microphone'] as const) {
    const answer = answers[id];
    access[id] = answer ? stateOf(answer) : 'unavailable';
    canAsk[id] = answer?.canAskAgain ?? false;
  }
  return { access, canAsk };
}

const CHECKING: Record<PhoneAccessId, AccessState> = {
  notifications: 'checking',
  location: 'checking',
  camera: 'checking',
  microphone: 'checking',
};

/**
 * The four phone permissions Capture sources lists, read live from the OS. Moni cannot turn a
 * permission off itself, so `change` asks when it still can and opens Settings otherwise.
 */
export function usePhoneAccess() {
  const [access, setAccess] = useState(CHECKING);
  const [canAsk, setCanAsk] = useState<Record<PhoneAccessId, boolean>>({
    notifications: false,
    location: false,
    camera: false,
    microphone: false,
  });

  const refresh = useCallback(async () => {
    const next = await readAll();
    setAccess(next.access);
    setCanAsk(next.canAsk);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const change = useCallback(
    async (id: PhoneAccessId) => {
      if (id === 'notifications') {
        openNotificationListenerSettings();
        return;
      }
      if (access[id] !== 'on' && canAsk[id]) {
        await PROBES[id].ask().catch(() => null);
        await refresh();
        return;
      }
      await Linking.openSettings();
    },
    [access, canAsk, refresh],
  );

  return { access, change };
}

/** "3 on, 1 not set up" for the Capture sources intro. */
export function accessSummary(access: Record<PhoneAccessId, AccessState>): string {
  const states = Object.values(access);
  const count = (state: AccessState) => states.filter((value) => value === state).length;
  const parts = [`${count('on')} on`];
  if (count('off')) parts.push(`${count('off')} off`);
  if (count('not_set_up')) parts.push(`${count('not_set_up')} not set up`);
  return parts.join(', ');
}
