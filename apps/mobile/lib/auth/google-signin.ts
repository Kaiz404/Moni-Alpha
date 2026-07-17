import { Platform } from 'react-native';
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { supabase } from '@/lib/supabase/client';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();

export function isGoogleSignInConfigured(): boolean {
  return Boolean(webClientId);
}

export function configureGoogleSignIn(): void {
  if (!webClientId) return;

  GoogleSignin.configure({
    webClientId,
    offlineAccess: false,
  });
}

export type GoogleSignInResult = {
  error: Error | null;
  cancelled?: boolean;
};

export async function signInWithGoogleNative(): Promise<GoogleSignInResult> {
  if (!webClientId) {
    return { error: new Error('Google Sign-In is not configured') };
  }

  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
    }

    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) {
      return {
        error: new Error('Sign in cancelled'),
        cancelled: true,
      };
    }
    if (!isSuccessResponse(response)) {
      return { error: new Error('Google Sign-In failed') };
    }

    let idToken = response.data.idToken;
    if (!idToken) {
      const tokens = await GoogleSignin.getTokens();
      idToken = tokens.idToken;
    }
    if (!idToken) {
      return {
        error: new Error(
          'No Google ID token received. Ensure EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is the Web OAuth client ID.',
        ),
      };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) return { error: new Error(error.message) };

    return { error: null };
  } catch (err) {
    if (isErrorWithCode(err)) {
      if (err.code === statusCodes.IN_PROGRESS) {
        return { error: new Error('Sign in already in progress') };
      }
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return {
          error: new Error('Google Play Services are not available'),
        };
      }
    }
    return {
      error: err instanceof Error ? err : new Error('Google Sign-In failed'),
    };
  }
}

export async function signOutGoogleNative(): Promise<void> {
  try {
    if (GoogleSignin.hasPreviousSignIn()) {
      await GoogleSignin.signOut();
    }
  } catch {
    // Best-effort; Supabase sign-out still runs.
  }
}
