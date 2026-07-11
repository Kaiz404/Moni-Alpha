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

const googleSignInPlugin: [string, { iosUrlScheme: string }] | string =
  iosUrlScheme != null
    ? ['@react-native-google-signin/google-signin', { iosUrlScheme }]
    : '@react-native-google-signin/google-signin';

export default {
  expo: {
    ...base,
    plugins: [...(base.plugins ?? []), googleSignInPlugin],
  },
} satisfies { expo: ExpoConfig };
