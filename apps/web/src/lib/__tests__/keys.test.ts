import { describe, expect, it } from 'vitest';
import { INITIAL_KEY_STATE, keyStep, type KeyInput } from '../keys';

const press = (key: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  key,
  ctrl: false,
  meta: false,
  alt: false,
  typing: false,
  ...extra,
});

describe('keyStep', () => {
  it.each([
    [press('k', { ctrl: true }), { kind: 'palette' }],
    [press('K', { meta: true }), { kind: 'palette' }],
    [press('k', { ctrl: true, typing: true }), { kind: 'palette' }],
    [press('Escape', { typing: true }), { kind: 'close' }],
    [press('/'), { kind: 'ask' }],
    [press('?'), { kind: 'shortcuts' }],
    [press('n'), { kind: 'add' }],
    [press('z', { ctrl: true }), { kind: 'undo' }],
    [press('/', { typing: true }), null],
    [press('n', { typing: true }), null],
    [press('z', { ctrl: true, typing: true }), null],
    [press('n', { alt: true }), null],
    [press('x'), null],
  ])('%o runs %o', (input, action) => {
    expect(keyStep(INITIAL_KEY_STATE, input)).toEqual({ state: { afterG: false }, action });
  });

  it('goes to a section with G then its letter', () => {
    const afterG = keyStep(INITIAL_KEY_STATE, press('g'));
    expect(afterG).toEqual({ state: { afterG: true }, action: null });
    expect(keyStep(afterG.state, press('b'))).toEqual({ state: { afterG: false }, action: { kind: 'go', to: 'budget' } });
    expect(keyStep(afterG.state, press('R'))).toEqual({ state: { afterG: false }, action: { kind: 'go', to: 'review' } });
  });

  it('drops a G followed by a letter no section has', () => {
    const afterG = keyStep(INITIAL_KEY_STATE, press('g'));
    expect(keyStep(afterG.state, press('q'))).toEqual({ state: { afterG: false }, action: null });
  });
});
