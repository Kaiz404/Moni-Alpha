import { signInCode } from '@/lib/auth/sign-in-link';

describe('signInCode', () => {
  it('reads the code from the web QR of either app', () => {
    expect(signInCode('moni://sign-in?code=Ab3_x-9')).toBe('Ab3_x-9');
    expect(signInCode('moni-e2e://sign-in?code=Ab3_x-9')).toBe('Ab3_x-9');
    expect(signInCode('moni:///sign-in?code=Ab3_x-9')).toBe('Ab3_x-9');
  });

  it('decodes the code and ignores other parameters', () => {
    expect(signInCode(' moni://sign-in?from=web&code=a%2Bb ')).toBe('a+b');
  });

  it('refuses a QR that is not a Moni sign-in link', () => {
    expect(signInCode('https://moni.app/sign-in?code=abc')).toBeNull();
    expect(signInCode('moni://wallet?code=abc')).toBeNull();
    expect(signInCode('moni://sign-in')).toBeNull();
    expect(signInCode('moni://sign-in?code=')).toBeNull();
    expect(signInCode('MAYBANK RM12.00')).toBeNull();
  });
});
