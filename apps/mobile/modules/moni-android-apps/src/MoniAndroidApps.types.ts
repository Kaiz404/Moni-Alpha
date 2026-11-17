import type { ViewProps } from 'react-native';

export type InstalledAppInfo = {
  packageName: string;
  label: string;
  iconUri: string | null;
};

/** The capture listener's binding. Times are epoch ms, and the last two survive a restart. */
export type ListenerState = {
  /** Bound in this process. A new process starts unbound until Android connects it. */
  connected: boolean;
  /** The first rebind asked for since the listener was last bound. */
  rebindRequestedAt: number | null;
  connectedAt: number | null;
  disconnectedAt: number | null;
};

/** Which page `openAutostartSettingsAsync` reached. */
export type AutostartOpened = 'autostart' | 'app_details' | 'none';

/**
 * Kept for the Expo module view template even though the app currently only
 * consumes the native package-query functions. Defining it here keeps the
 * native and web view shims type-safe when TypeScript checks the module.
 */
export type MoniAndroidAppsViewProps = ViewProps & {
  url: string;
  onLoad: (event: { nativeEvent: { url: string } }) => void;
};
