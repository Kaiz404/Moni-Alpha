import { describe, expect, it } from 'vitest';
import { countdown, nextPollDelay, qrReducer, signInLink, type QrState } from '../qr-sign-in';

const T0 = Date.parse('2026-11-19T10:00:00.000Z');

const showing: QrState = qrReducer(
  { kind: 'starting' },
  {
    type: 'started',
    start: {
      requestId: '6f1c2a4e-8b3d-4c5f-9a7e-1d2b3c4d5e6f',
      pollSecret: 'secret',
      code: 'code-1',
      codeExpiresAt: '2026-11-19T10:01:00.000Z',
      expiresAt: '2026-11-19T10:10:00.000Z',
    },
  },
);

describe('qrReducer', () => {
  it('shows the started code until its expiry', () => {
    expect(showing).toEqual({
      kind: 'showing',
      pollSecret: 'secret',
      code: 'code-1',
      codeExpiresAt: T0 + 60_000,
      expiresAt: T0 + 600_000,
    });
  });

  it('swaps in the rotated code a poll returns', () => {
    const rotated = qrReducer(showing, {
      type: 'polled',
      poll: { status: 'waiting', code: 'code-2', codeExpiresAt: '2026-11-19T10:02:00.000Z' },
    });
    expect(rotated).toEqual({ ...showing, code: 'code-2', codeExpiresAt: T0 + 120_000 });
  });

  it('ends on approved with the token hash, or expired', () => {
    expect(qrReducer(showing, { type: 'polled', poll: { status: 'approved', tokenHash: 'hash' } })).toEqual({
      kind: 'approved',
      tokenHash: 'hash',
    });
    expect(qrReducer(showing, { type: 'polled', poll: { status: 'expired' } })).toEqual({ kind: 'expired' });
  });

  it('ignores a late poll once the request ended', () => {
    expect(qrReducer({ kind: 'expired' }, { type: 'polled', poll: { status: 'approved', tokenHash: 'h' } })).toEqual({
      kind: 'expired',
    });
  });
});

describe('nextPollDelay', () => {
  it.each([
    [T0, 3000],
    [T0 + 58_000, 2000],
    [T0 + 59_900, 100],
    [T0 + 61_000, 0],
  ])('at %i polls after %i ms', (now, delay) => {
    expect(nextPollDelay(showing, now)).toBe(delay);
  });

  it('stops polling outside the showing state', () => {
    expect(nextPollDelay({ kind: 'starting' }, T0)).toBeNull();
    expect(nextPollDelay({ kind: 'approved', tokenHash: 'h' }, T0)).toBeNull();
  });
});

describe('countdown', () => {
  it.each([
    [T0, '1:00'],
    [T0 + 18_000, '0:42'],
    [T0 + 18_400, '0:42'],
    [T0 + 59_999, '0:01'],
    [T0 + 75_000, '0:00'],
  ])('at %i reads %s', (now, text) => {
    expect(countdown(T0 + 60_000, now)).toBe(text);
  });
});

describe('signInLink', () => {
  it('holds the code for the phone scanner', () => {
    expect(signInLink('a-b_c', 'moni')).toBe('moni://sign-in?code=a-b_c');
    expect(signInLink('a+b', 'moni-e2e')).toBe('moni-e2e://sign-in?code=a%2Bb');
  });
});
