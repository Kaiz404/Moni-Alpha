import { describe, expect, it } from 'vitest';
import { isPublicPath, safeNextPath } from '../routes';

describe('isPublicPath', () => {
  it.each([
    ['/', true],
    ['/login', true],
    ['/delete-account', true],
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
