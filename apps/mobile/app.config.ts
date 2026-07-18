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

const base = appJson.expo as ExpoConfig;
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
const googleMapsPlugin: [string, Record<string, string>] = [
  'react-native-maps',
  googleMapsConfig,
];
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
      googleSignInPlugin,
    ],
  },
} satisfies { expo: ExpoConfig };
