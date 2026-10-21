export type LoginMode = 'signIn' | 'createAccount';

export type LoginVia = 'password' | 'google';

/** Every frame of V2H-Login below the form: one at a time. */
export type LoginStatus =
  | { kind: 'idle' }
  | { kind: 'busy'; via: LoginVia }
  | { kind: 'wrongDetails' }
  | { kind: 'confirmEmail'; email: string }
  | { kind: 'googleDidNotFinish' }
  | { kind: 'offline' }
  | { kind: 'failed'; message: string };

export type LoginState = { mode: LoginMode; status: LoginStatus };

export type LoginDetails = { name: string; email: string; password: string };

export type LoginEvent =
  | { type: 'setMode'; mode: LoginMode }
  | { type: 'edited' }
  | { type: 'started'; via: LoginVia }
  | { type: 'rejected'; status: LoginStatus }
  | { type: 'passwordFailed'; message: string; email: string }
  | { type: 'googleFailed'; message: string }
  | { type: 'accountNeedsConfirmation'; email: string }
  | { type: 'signedIn' };

export const initialLoginState: LoginState = {
  mode: 'signIn',
  status: { kind: 'idle' },
};

export const MIN_PASSWORD_LENGTH = 8;

const NETWORK = /network request failed|failed to fetch|fetch failed|network error|timed out|offline/i;

/** Checks the form before it reaches Supabase, so Zod's wording never shows. */
export function checkDetails(mode: LoginMode, details: LoginDetails): LoginStatus | null {
  const email = details.email.trim();
  if (mode === 'createAccount') {
    if (!details.name.trim() || !email || !details.password) {
      return { kind: 'failed', message: 'Add your name, email and a password.' };
    }
    if (details.password.length < MIN_PASSWORD_LENGTH) {
      return { kind: 'failed', message: 'Use at least 8 characters for your password.' };
    }
    return null;
  }
  if (!email || !details.password) {
    return { kind: 'failed', message: 'Add your email and password.' };
  }
  if (details.password.length < MIN_PASSWORD_LENGTH) return { kind: 'wrongDetails' };
  return null;
}

/** Maps a Supabase auth error message to the state the page shows. */
export function classifyAuthError(mode: LoginMode, message: string, email: string): LoginStatus {
  if (NETWORK.test(message)) return { kind: 'offline' };
  if (/email not confirmed/i.test(message)) return { kind: 'confirmEmail', email };
  if (mode === 'signIn') {
    if (/invalid login credentials|invalid email|password/i.test(message)) {
      return { kind: 'wrongDetails' };
    }
    return { kind: 'failed', message: "Moni couldn't sign you in. Try again." };
  }
  if (/already (registered|exists)/i.test(message)) {
    return { kind: 'failed', message: 'That email already has an account. Sign in instead.' };
  }
  if (/password/i.test(message)) {
    return { kind: 'failed', message: 'Use at least 8 characters for your password.' };
  }
  if (/email/i.test(message)) {
    return { kind: 'failed', message: 'Check the email address and try again.' };
  }
  return { kind: 'failed', message: "Moni couldn't create your account. Try again." };
}

export function loginReducer(state: LoginState, event: LoginEvent): LoginState {
  switch (event.type) {
    case 'setMode':
      return event.mode === state.mode ? state : { mode: event.mode, status: { kind: 'idle' } };
    case 'edited':
      return state.status.kind === 'wrongDetails' || state.status.kind === 'failed'
        ? { ...state, status: { kind: 'idle' } }
        : state;
    case 'started':
      return { ...state, status: { kind: 'busy', via: event.via } };
    case 'rejected':
      return { ...state, status: event.status };
    case 'passwordFailed':
      return { ...state, status: classifyAuthError(state.mode, event.message, event.email) };
    case 'googleFailed':
      return {
        ...state,
        status: NETWORK.test(event.message) ? { kind: 'offline' } : { kind: 'googleDidNotFinish' },
      };
    case 'accountNeedsConfirmation':
      return { mode: 'signIn', status: { kind: 'confirmEmail', email: event.email } };
    case 'signedIn':
      return { ...state, status: { kind: 'idle' } };
  }
}
