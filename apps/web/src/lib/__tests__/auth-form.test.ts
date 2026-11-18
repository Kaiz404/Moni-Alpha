import { describe, expect, it } from 'vitest';
import { authErrorStatus, canCreate, checkAge, checkSignIn } from '../auth-form';

const TODAY = new Date(2026, 10, 19);
const filled = { name: 'Kai', email: 'kai@example.com', password: 'password1', birthMonth: '1995-04', agreed: true };

describe('checkSignIn', () => {
  it.each([
    [{ email: '', password: 'password1' }, { kind: 'failed', message: 'Add your email and password.' }],
    [{ email: 'kai@example.com', password: 'short' }, { kind: 'wrongDetails' }],
    [{ email: 'kai@example.com', password: 'password1' }, null],
  ])('%o is %o', (details, expected) => {
    expect(checkSignIn(details)).toEqual(expected);
  });
});

describe('checkAge', () => {
  it.each([
    ['', { ok: false, underAge: false }],
    ['2008-', { ok: false, underAge: false }],
    ['2008-12', { ok: false, underAge: true }],
    ['2008-11', { ok: true, birthMonth: '2008-11' }],
  ])('%s is %o', (birthMonth, expected) => {
    expect(checkAge(birthMonth, TODAY)).toEqual(expected);
  });
});

describe('canCreate', () => {
  it.each([
    [filled, true],
    [{ ...filled, agreed: false }, false],
    [{ ...filled, name: ' ' }, false],
    [{ ...filled, password: 'short' }, false],
    [{ ...filled, birthMonth: '2010-01' }, false],
  ])('%o: %s', (details, expected) => {
    expect(canCreate(details, TODAY)).toBe(expected);
  });
});

describe('authErrorStatus', () => {
  it.each([
    ['signIn', 'Invalid login credentials', { kind: 'wrongDetails' }],
    ['signIn', 'TypeError: Failed to fetch', { kind: 'offline' }],
    ['signIn', 'Email not confirmed', { kind: 'failed', message: 'Confirm your email first. Open the link Moni sent you.' }],
    ['createAccount', 'User already registered', { kind: 'failed', message: 'That email already has an account. Sign in instead.' }],
    ['createAccount', 'Something odd', { kind: 'failed', message: "Moni couldn't create your account. Try again." }],
  ] as const)('%s: %s', (mode, message, expected) => {
    expect(authErrorStatus(mode, message)).toEqual(expected);
  });
});
