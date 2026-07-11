/**
 * Debug helpers for verifying the notification capture → MMKV → UI path.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { createMMKV } from 'react-native-mmkv';
import { passesNotificationTransactionPrefilter } from '@/lib/notifications/notification-filter';
import type { PermissionStatus } from '@/hooks/use-notification-listener';
import type { LogFn, DebugTestResult } from './types';

const CAPTURED_KEY = 'captured_notifications';
const notificationStorage = createMMKV({ id: 'moni-notifications' });

export type NotificationDiagnostics = {
  isAndroid: boolean;
  isExpoGo: boolean;
  isDevClient: boolean;
  nativeModuleLoaded: boolean;
  troubleshooting: string[];
};

export function getNotificationDiagnostics(
  permissionStatus: PermissionStatus,
): NotificationDiagnostics {
  const isAndroid = Platform.OS === 'android';
  const isExpoGo = Constants.appOwnership === 'expo';
  const isDevClient = isAndroid && !isExpoGo;
  const nativeModuleLoaded = permissionStatus !== 'unknown' || isExpoGo === false;

  const troubleshooting: string[] = [];

  if (!isAndroid) {
    troubleshooting.push('Notification listener is Android-only.');
  } else if (isExpoGo) {
    troubleshooting.push(
      'You are on Expo Go — the listener native module is not included. Run pnpm --filter moni android to use a dev client.',
    );
  } else if (!isDevClient) {
    troubleshooting.push('Use a dev client build (pnpm --filter moni android), not Expo Go.');
  }

  if (isDevClient && permissionStatus === 'authorized') {
    troubleshooting.push(
      'Dev builds use Headless JS — keep Metro running and open the app once after install.',
    );
    troubleshooting.push(
      'Trigger a real notification from another app (e.g. a bank alert). Standard push to Moni itself is not captured.',
    );
    troubleshooting.push(
      'If still empty: toggle notification access off/on in system settings, or reboot the device.',
    );
  }

  if (permissionStatus === 'denied') {
    troubleshooting.unshift(
      'Notification access is off — enable Moni under Settings → Special app access → Notification access.',
    );
  }

  troubleshooting.push(
    'App Info → Notifications controls whether Moni can show its own alerts. Moni needs Notification access (listener) to read bank/wallet apps.',
  );

  return {
    isAndroid,
    isExpoGo,
    isDevClient,
    nativeModuleLoaded,
    troubleshooting,
  };
}

function readCapturedList(): unknown[] {
  try {
    const raw = notificationStorage.getString(CAPTURED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Inject a fake capture into MMKV to verify the debug UI read path. */
export async function injectTestNotificationCapture(log: LogFn): Promise<DebugTestResult> {
  const sample = {
    time: new Date().toISOString(),
    app: 'Debug Test Bank',
    title: 'Debug Test Bank',
    titleBig: '',
    text: 'You paid MYR 12.50 to Test Merchant.',
    subText: '',
    summaryText: '',
    bigText: '',
    extraInfoText: '',
    groupedMessages: [],
  };

  const prefilterPassed = passesNotificationTransactionPrefilter(sample);
  const enriched = {
    ...sample,
    id: `debug-${Date.now()}`,
    receivedAt: new Date().toISOString(),
    prefilterPassed,
  };

  const list = readCapturedList();
  list.unshift(enriched);
  notificationStorage.set(CAPTURED_KEY, JSON.stringify(list.slice(0, 50)));

  log(`Injected test notification (prefilter=${prefilterPassed ? 'pass' : 'fail'})`);
  log('If the pipeline panel updates, MMKV reads are working — the gap is native capture.');

  return {
    success: true,
    summary: 'Test notification written to MMKV',
  };
}
