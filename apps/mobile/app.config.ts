import type { ExpoConfig } from 'expo/config';
import appJson from './app.json';

function googleIosUrlScheme(): string | undefined {
  const explicit = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim();
  if (explicit) return explicit;

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  if (!webClientId?.endsWith('.apps.googleusercontent.com')) return undefined;

  const clientPrefix = webClientId.replace('.apps.googleusercontent.com', '');
  return `com.googleusercontent.apps.${clientPrefix}`;
}

const daily = appJson.expo as ExpoConfig;
const e2eId = 'com.anonymous.moni.e2e';
// The e2e build installs beside the daily app, so it needs its own package and
// scheme; a shared `moni://` would make Android ask which app opens the link.
const base: ExpoConfig =
  process.env.APP_VARIANT === 'e2e'
    ? {
        ...daily,
        name: 'Moni E2E',
        scheme: 'moni-e2e',
        android: { ...daily.android, package: e2eId },
        ios: { ...daily.ios, bundleIdentifier: e2eId },
      }
    : daily;
const iosUrlScheme = googleIosUrlScheme();
const androidGoogleMapsApiKey = process.env.ANDROID_GOOGLE_MAPS_API_KEY?.trim();
const iosGoogleMapsApiKey = process.env.IOS_GOOGLE_MAPS_API_KEY?.trim();

const googleSignInPlugin: [string, { iosUrlScheme: string }] | string =
  iosUrlScheme != null
    ? ['@react-native-google-signin/google-signin', { iosUrlScheme }]
    : '@react-native-google-signin/google-signin';

const googleMapsConfig: Record<string, string> = {};
if (androidGoogleMapsApiKey) {
  googleMapsConfig.androidGoogleMapsApiKey = androidGoogleMapsApiKey;
}
if (iosGoogleMapsApiKey) {
  googleMapsConfig.iosGoogleMapsApiKey = iosGoogleMapsApiKey;
}
const googleMapsPlugin: [string, Record<string, string>] = ['react-native-maps', googleMapsConfig];
const basePluginsWithoutGoogleMaps = (base.plugins ?? []).filter(
  (plugin) => !(Array.isArray(plugin) && plugin[0] === 'react-native-maps'),
);

export default {
  expo: {
    ...base,
    plugins: [
      ...basePluginsWithoutGoogleMaps,
      googleMapsPlugin,
      'expo-font',
      'expo-image',
      'expo-secure-store',
      'expo-status-bar',
      'expo-web-browser',
      '@react-native-vector-icons/ionicons',
      '@react-native-vector-icons/feather',
      '@react-native-vector-icons/fontawesome6',
      '@react-native-vector-icons/material-design-icons',
      googleSignInPlugin,
    ],
  },
} satisfies { expo: ExpoConfig };
