import { describe, expect, it } from 'vitest';
import { isPublicPath, isSignedOutOnly, safeNextPath } from '../routes';

describe('isPublicPath', () => {
  it.each([
    ['/', true],
    ['/login', true],
    ['/login/forgot', true],
    ['/login/verify', true],
    ['/login/reset', true],
    ['/help', true],
    ['/delete-account', true],
    ['/delete-account/done', true],
    ['/delete-account/other', false],
    ['/privacy', true],
    ['/terms', true],
    ['/auth/callback', true],
    ['/home', false],
    ['/activity', false],
    ['/loginx', false],
    ['/auth', false],
  ])('%s is public: %s', (path, expected) => {
    expect(isPublicPath(path)).toBe(expected);
  });
});

describe('isSignedOutOnly', () => {
  it.each([
    ['/', true],
    ['/login', true],
    ['/login/forgot', true],
    ['/login/verify', false],
    ['/login/reset', false],
    ['/home', false],
  ])('%s sends a signed-in visitor home: %s', (path, expected) => {
    expect(isSignedOutOnly(path)).toBe(expected);
  });
});

describe('safeNextPath', () => {
  it.each([
    [null, '/home'],
    ['/activity?view=table', '/activity?view=table'],
    ['//evil.example', '/home'],
    ['https://evil.example', '/home'],
  ])('%s becomes %s', (next, expected) => {
    expect(safeNextPath(next)).toBe(expected);
  });
});
