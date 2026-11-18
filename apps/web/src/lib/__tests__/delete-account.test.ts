import { describe, expect, it } from 'vitest';
import { confirmsDeletion, deletionFailure } from '../delete-account';

describe('confirmsDeletion', () => {
  it.each([
    ['DELETE', true],
    ['delete', true],
    ['Delete', true],
    ['  delete \n', true],
    ['', false],
    ['DELET', false],
    ['DELETE ME', false],
    ['DELETED', false],
    ['D E L E T E', false],
  ])('%j confirms: %s', (typed, expected) => {
    expect(confirmsDeletion(typed)).toBe(expected);
  });
});

describe('deletionFailure', () => {
  it('has no line once the account is gone', () => {
    expect(deletionFailure({ kind: 'ok', data: { ok: true } })).toBeNull();
  });

  it('asks to check the connection when Moni is unreachable', () => {
    expect(deletionFailure({ kind: 'unreachable' })).toBe("Couldn't reach Moni. Check your connection and try again.");
  });

  it("passes on the function's own refusal", () => {
    expect(
      deletionFailure({
        kind: 'refused',
        status: 401,
        message: 'Sign in again to delete your account',
      }),
    ).toBe("Couldn't delete your account. Sign in again to delete your account");
  });
});
