import { checkDetails, initialLoginState, loginReducer, type LoginState } from '../login-mode';

const signingIn: LoginState = { mode: 'signIn', status: { kind: 'busy', via: 'password' } };

describe('loginReducer', () => {
  it('maps Invalid login credentials to the wrong-details state', () => {
    expect(
      loginReducer(signingIn, {
        type: 'passwordFailed',
        message: 'Invalid login credentials',
        email: 'kai@example.com',
      }),
    ).toEqual({ mode: 'signIn', status: { kind: 'wrongDetails' } });
  });

  it('shows the offline state when the request never reached Supabase', () => {
    expect(
      loginReducer(signingIn, {
        type: 'passwordFailed',
        message: 'Network request failed',
        email: 'kai@example.com',
      }).status,
    ).toEqual({ kind: 'offline' });
  });

  it('asks to confirm the email after an account is created without a session', () => {
    const creating: LoginState = {
      mode: 'createAccount',
      status: { kind: 'busy', via: 'password' },
    };
    expect(
      loginReducer(creating, { type: 'accountNeedsConfirmation', email: 'kai@example.com' }),
    ).toEqual({ mode: 'signIn', status: { kind: 'confirmEmail', email: 'kai@example.com' } });
  });

  it('says Google did not finish when the Google sheet is closed', () => {
    const google: LoginState = { mode: 'signIn', status: { kind: 'busy', via: 'google' } };
    expect(
      loginReducer(google, { type: 'googleFailed', message: 'Sign in cancelled' }).status,
    ).toEqual({ kind: 'googleDidNotFinish' });
  });

  it('clears wrong details once the user edits a field', () => {
    const wrong: LoginState = { mode: 'signIn', status: { kind: 'wrongDetails' } };
    expect(loginReducer(wrong, { type: 'edited' })).toEqual(initialLoginState);
  });

  it('names an existing account when creating one', () => {
    const creating: LoginState = {
      mode: 'createAccount',
      status: { kind: 'busy', via: 'password' },
    };
    expect(
      loginReducer(creating, {
        type: 'passwordFailed',
        message: 'User already registered',
        email: 'kai@example.com',
      }).status,
    ).toEqual({ kind: 'failed', message: 'That email already has an account. Sign in instead.' });
  });
});

describe('checkDetails', () => {
  const today = new Date(2026, 10, 19);
  const kai = {
    name: 'Kai',
    email: 'kai@example.com',
    password: 'long enough',
    birthMonth: '1996-04',
  };

  it('treats a short password on sign in as wrong details', () => {
    expect(
      checkDetails(
        'signIn',
        { name: '', email: 'kai@example.com', password: 'short', birthMonth: null },
        today,
      ),
    ).toEqual({ kind: 'wrongDetails' });
  });

  it('asks for at least 8 characters when creating an account', () => {
    expect(checkDetails('createAccount', { ...kai, password: 'short' }, today)).toEqual({
      kind: 'failed',
      message: 'Use at least 8 characters for your password.',
    });
  });

  it('asks for the date of birth before creating an account', () => {
    expect(checkDetails('createAccount', { ...kai, birthMonth: null }, today)).toEqual({
      kind: 'failed',
      message: 'Add your name, email, a password and your date of birth.',
    });
  });

  it('turns away anyone under 18, counting from their 18th birthday month', () => {
    const underAge = {
      kind: 'failed',
      message: "Moni is for people 18 and over, so we can't create an account for you.",
    };
    expect(checkDetails('createAccount', { ...kai, birthMonth: '2008-12' }, today)).toEqual(
      underAge,
    );
    expect(checkDetails('createAccount', { ...kai, birthMonth: '2010-01' }, today)).toEqual(
      underAge,
    );
    expect(checkDetails('createAccount', { ...kai, birthMonth: '2008-11' }, today)).toBeNull();
    expect(checkDetails('createAccount', { ...kai, birthMonth: '2008-10' }, today)).toBeNull();
  });

  it('passes complete details', () => {
    expect(checkDetails('createAccount', kai, today)).toBeNull();
  });
});
