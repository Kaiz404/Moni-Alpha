import { birthMonthSchema, isOldEnoughToSignUp, type BirthMonth } from '@repo/types';

/** The sign-in and create-account forms' states. The words match the phone's login page. */
export type FormStatus =
  | { kind: 'idle' }
  | { kind: 'busy'; via: 'password' | 'google' }
  | { kind: 'wrongDetails' }
  | { kind: 'offline' }
  | { kind: 'failed'; message: string };

export const MIN_PASSWORD_LENGTH = 8;
export const WRONG_DETAILS = "That email and password don't match. Check both and try again.";
export const OFFLINE = "Moni can't reach the internet. Check your connection and try again.";
export const UNDER_AGE = "Moni is for people 18 and over, so we can't create an account for you.";

const NETWORK = /network request failed|failed to fetch|fetch failed|network error|timed out|offline/i;

export type SignInDetails = { email: string; password: string };

export type CreateDetails = {
  name: string;
  email: string;
  password: string;
  /** "YYYY-MM", or "" until both the month and the year are picked. */
  birthMonth: string;
  agreed: boolean;
};

export function checkSignIn(details: SignInDetails): FormStatus | null {
  if (!details.email.trim() || !details.password) return { kind: 'failed', message: 'Add your email and password.' };
  if (details.password.length < MIN_PASSWORD_LENGTH) return { kind: 'wrongDetails' };
  return null;
}

/** The birth month when it is complete and 18 or more years back, else why not. */
export function checkAge(birthMonth: string, today: Date): { ok: true; birthMonth: BirthMonth } | { ok: false; underAge: boolean } {
  const parsed = birthMonthSchema.safeParse(birthMonth);
  if (!parsed.success) return { ok: false, underAge: false };
  return isOldEnoughToSignUp(parsed.data, today) ? { ok: true, birthMonth: parsed.data } : { ok: false, underAge: true };
}

/** Create account stays Sand until every field is filled, the age passes and the terms are ticked. */
export function canCreate(details: CreateDetails, today: Date): boolean {
  return (
    details.name.trim() !== '' &&
    details.email.trim() !== '' &&
    details.password.length >= MIN_PASSWORD_LENGTH &&
    checkAge(details.birthMonth, today).ok &&
    details.agreed
  );
}

/** Maps a Supabase auth error to what the form shows, so Supabase's wording never does. */
export function authErrorStatus(mode: 'signIn' | 'createAccount', message: string): FormStatus {
  if (NETWORK.test(message)) return { kind: 'offline' };
  if (mode === 'signIn') {
    if (/email not confirmed/i.test(message)) {
      return { kind: 'failed', message: 'Confirm your email first. Open the link Moni sent you.' };
    }
    if (/invalid login credentials|invalid email|password/i.test(message)) return { kind: 'wrongDetails' };
    return { kind: 'failed', message: "Moni couldn't sign you in. Try again." };
  }
  if (/already (registered|exists)/i.test(message)) {
    return { kind: 'failed', message: 'That email already has an account. Sign in instead.' };
  }
  if (/password/i.test(message)) return { kind: 'failed', message: 'Use at least 8 characters for your password.' };
  if (/email/i.test(message)) return { kind: 'failed', message: 'Check the email address and try again.' };
  return { kind: 'failed', message: "Moni couldn't create your account. Try again." };
}

export function statusMessage(status: FormStatus): string | null {
  switch (status.kind) {
    case 'wrongDetails':
      return WRONG_DETAILS;
    case 'offline':
      return OFFLINE;
    case 'failed':
      return status.message;
    default:
      return null;
  }
}
