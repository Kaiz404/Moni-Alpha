import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { reportMissedFrom } from '@/components/capture-log/report-missed';
import { useBatteryExemption } from '@/components/capture-sources/use-battery-exemption';
import { useCaptureHealth } from '@/components/capture-sources/use-capture-health';
import { useLinkedApps } from '@/components/capture-sources/use-linked-apps';
import {
  askForBatteryExemption,
  hasAutostartSetting,
  openAutostart,
  phoneBrand,
} from '@/lib/notifications/battery';
import {
  assessCaptureHealth,
  captureAlertCopy,
  type CaptureAlert,
  type CaptureAlertCopy,
} from '@/lib/notifications/capture-cadence';
import { dismissAccessOff, dismissQuietSource } from '@/lib/notifications/capture-health';
import {
  askForNotificationAccess,
  openNotificationListenerSettings,
  readNotificationListenerPermission,
} from '@/lib/notifications/permission';

type ListenerState = 'on' | 'off' | 'unknown';

function useListenerState(): ListenerState {
  const [state, setState] = useState<ListenerState>('unknown');
  const refresh = useCallback(() => {
    void readNotificationListenerPermission().then((permission) =>
      setState(permission === 'authorized' ? 'on' : permission === 'denied' ? 'off' : 'unknown'),
    );
  }, []);

  useFocusEffect(refresh);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return state;
}

export type CaptureAlertModel = CaptureAlertCopy & {
  alert: CaptureAlert;
  fix: () => void;
  dismiss: () => void;
};

/** The one thing worth saying about capture right now, with its fix. Android only. */
export function useCaptureAlert(): CaptureAlertModel | null {
  const listener = useListenerState();
  const battery = useBatteryExemption();
  const { health, refresh } = useCaptureHealth();
  const { apps, wallets } = useLinkedApps();

  if (Platform.OS !== 'android') return null;

  const alert = assessCaptureHealth({
    apps: apps.map(({ packageName, label }) => ({ packageName, label })),
    health,
    listener,
    battery,
    autostart: hasAutostartSetting(phoneBrand()),
    now: new Date(),
  });
  if (!alert) return null;

  return {
    alert,
    ...captureAlertCopy(alert),
    fix: () => {
      switch (alert.fix) {
        case 'turn_on_access':
          void askForNotificationAccess();
          return;
        case 'open_access':
          openNotificationListenerSettings();
          return;
        case 'battery':
          void askForBatteryExemption();
          return;
        case 'autostart':
          void openAutostart();
          return;
        case 'report_missed':
          reportMissedFrom(alert.apps[0]!.packageName, wallets);
          return;
        case 'open_log':
          router.push('/capture-log');
      }
    },
    dismiss: () => {
      if (alert.kind === 'access_off') dismissAccessOff();
      else for (const app of alert.apps) dismissQuietSource(app.packageName);
      refresh();
    },
  };
}
