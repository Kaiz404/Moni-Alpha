import { describe, expect, it } from 'vitest';
import { birthMonthSchema, isOldEnoughToSignUp, userPreferencesSchema } from '../user';

describe('isOldEnoughToSignUp', () => {
  it.each([
    ['2008-11', new Date(2026, 10, 1), true],
    ['2008-11', new Date(2026, 9, 31), false],
    ['2008-12', new Date(2026, 10, 19), false],
    ['1990-01', new Date(2026, 10, 19), true],
  ])('born %s, on %s: %s', (birthMonth, today, expected) => {
    expect(isOldEnoughToSignUp(birthMonth, today)).toBe(expected);
  });
});

describe('birthMonthSchema', () => {
  it.each([
    ['2008-11', true],
    ['2008-13', false],
    ['2008-1', false],
    ['2008-11-02', false],
  ])('%s parses: %s', (value, expected) => {
    expect(birthMonthSchema.safeParse(value).success).toBe(expected);
  });
});

describe('userPreferencesSchema set-up fields', () => {
  it('keeps a finished set-up and a hidden checklist', () => {
    expect(
      userPreferencesSchema.parse({ currency: 'SGD', setup_finished_at: '2026-10-14T07:00:00.000Z', setup_checklist_hidden: true }),
    ).toEqual({
      currency: 'SGD',
      theme: 'system',
      notifications_enabled: true,
      setup_finished_at: '2026-10-14T07:00:00.000Z',
      setup_checklist_hidden: true,
    });
  });

  it('drops a malformed set-up time instead of failing the whole profile', () => {
    expect(userPreferencesSchema.parse({ currency: 'SGD', setup_finished_at: 'yesterday' })).toEqual({
      currency: 'SGD',
      theme: 'system',
      notifications_enabled: true,
    });
  });
});
