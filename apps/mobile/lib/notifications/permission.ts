import { Platform } from 'react-native';

import { openSheet } from '@/lib/sheet/sheet-store';
import MoniAndroidApps, { type ListenerState } from '@/modules/moni-android-apps';

/** Android notification *listener* access (read other apps' alerts). Not POST_NOTIFICATIONS. */
export type NotificationListenerPermission = 'authorized' | 'denied' | 'unknown' | 'unavailable';

function normalizeStatus(raw: unknown): NotificationListenerPermission {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (value === 'authorized') return 'authorized';
  if (value === 'denied') return 'denied';
  if (value === 'unavailable') return 'unavailable';
  return 'unknown';
}

/** Live read of Android's enabled listeners, never cached. A build without the native call reads unknown. */
export async function readNotificationListenerPermission(): Promise<NotificationListenerPermission> {
  if (Platform.OS !== 'android') return 'unavailable';

  try {
    const raw = await MoniAndroidApps.getListenerPermissionAsync?.();
    return normalizeStatus(raw);
  } catch {
    return 'unknown';
  }
}

/** Long enough for Android to bind the listener after a rebind, or after the process starts. */
export const REBIND_GRACE_MS = 10_000;

/**
 * Access on is not the listener bound: HyperOS can unbind it until Moni opens again. Unbound only
 * once a rebind has had time to land, since a process starts unbound until Android connects it.
 */
export function isListenerUnbound(state: ListenerState, now: number): boolean {
  return (
    !state.connected &&
    state.rebindRequestedAt !== null &&
    now - state.rebindRequestedAt >= REBIND_GRACE_MS
  );
}

/** Asks Android to bind the listener again if it is not bound, and says whether it is unbound. */
export function rebindListenerIfUnbound(now = Date.now()): boolean {
  if (Platform.OS !== 'android') return false;
  try {
    MoniAndroidApps.requestListenerRebind?.();
    const state = MoniAndroidApps.getListenerState?.();
    return state ? isListenerUnbound(state, now) : false;
  } catch {
    return false;
  }
}

/**
 * Google Play wants this in the app right before access is asked for. Both halves must stay true:
 * `isOneTimeCode` holds the first, and run-extraction sends the rest to the Go backend's model.
 */
export const NOTIFICATION_ACCESS_DISCLOSURE =
  'One-time codes never leave this phone, and other payment alerts from the apps you link go to a cloud AI model that reads them.';

export function openNotificationListenerSettings(): void {
  if (Platform.OS !== 'android') return;
  MoniAndroidApps.openListenerSettings?.();
}

/** The way to ask for access. Android's settings page says nothing about what Moni does with it. */
export async function askForNotificationAccess(): Promise<void> {
  const confirmed = await openSheet({
    kind: 'confirm',
    title: 'Let Moni read alerts?',
    message: NOTIFICATION_ACCESS_DISCLOSURE,
    confirmLabel: 'Open settings',
    cancelLabel: 'Not now',
  });
  if (confirmed) openNotificationListenerSettings();
}
