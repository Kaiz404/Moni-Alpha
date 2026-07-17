import type { ViewProps } from 'react-native';

export type InstalledAppInfo = {
  packageName: string;
  label: string;
  iconUri: string | null;
};

/**
 * Kept for the Expo module view template even though the app currently only
 * consumes the native package-query functions. Defining it here keeps the
 * native and web view shims type-safe when TypeScript checks the module.
 */
export type MoniAndroidAppsViewProps = ViewProps & {
  url: string;
  onLoad: (event: { nativeEvent: { url: string } }) => void;
};
