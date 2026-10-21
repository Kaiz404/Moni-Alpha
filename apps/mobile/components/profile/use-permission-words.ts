import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import { readNotificationListenerPermission } from '@/lib/notifications/permission';

export type PermissionWord = 'On' | 'Off' | 'Not set up';

export type PermissionWords = {
  notifications: PermissionWord;
  location: PermissionWord;
  camera: PermissionWord;
  microphone: PermissionWord;
};

function word(status: string | undefined): PermissionWord {
  if (status === 'granted' || status === 'authorized') return 'On';
  if (status === 'denied') return 'Off';
  return 'Not set up';
}

async function readPermissionWords(): Promise<PermissionWords> {
  const [notifications, location, camera, microphone] = await Promise.all([
    readNotificationListenerPermission(),
    Location.getForegroundPermissionsAsync(),
    ImagePicker.getCameraPermissionsAsync(),
    ExpoSpeechRecognitionModule.getPermissionsAsync(),
  ]);
  return {
    // Android reports a listener that was never turned on as denied: it is still off.
    notifications: notifications === 'authorized' ? 'On' : 'Off',
    location: word(location.status),
    camera: word(camera.status),
    microphone: microphone.granted ? 'On' : word(microphone.status),
  };
}

/** Phone access for the CAPTURE SOURCES rows, read again each time Profile gains focus. */
export function usePermissionWords(): PermissionWords | null {
  const [words, setWords] = useState<PermissionWords | null>(null);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      void readPermissionWords().then((next) => {
        if (live) setWords(next);
      });
      return () => {
        live = false;
      };
    }, []),
  );
  return words;
}
