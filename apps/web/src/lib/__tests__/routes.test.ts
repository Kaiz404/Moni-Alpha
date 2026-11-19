import { describe, expect, it } from 'vitest';
import { isPublicPath, isSignedOutOnly, safeNextPath, showsMaintenance } from '../routes';

describe('isPublicPath', () => {
  it.each([
    ['/', true],
    ['/login', true],
    ['/login/forgot', true],
    ['/login/verify', true],
    ['/login/reset', true],
    ['/help', true],
    ['/maintenance', true],
    ['/delete-account', true],
    ['/delete-account/done', true],
    ['/delete-account/other', false],
    ['/privacy', true],
    ['/privacy/ms', true],
    ['/privacy/en', false],
    ['/terms', true],
    ['/terms/ms', true],
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
    ['/', false],
    ['/privacy', false],
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

describe('showsMaintenance', () => {
  it.each([
    ['/home', '2026-10-14T07:30:00Z', true],
    ['/', '2026-10-14T07:30:00Z', true],
    ['/maintenance', '2026-10-14T07:30:00Z', false],
    ['/privacy/ms', '2026-10-14T07:30:00Z', false],
    ['/home', undefined, false],
    ['/home', '', false],
  ])('%s while the update runs until %s: %s', (path, until, expected) => {
    expect(showsMaintenance(path, until)).toBe(expected);
  });
});
