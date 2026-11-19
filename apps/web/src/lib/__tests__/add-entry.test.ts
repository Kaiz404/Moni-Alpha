import { createCalendar, type FinanceWallet, type PlanContext } from '@repo/core';
import type { CurrencyCode, MinorAmount } from '@repo/types';
import { describe, expect, it } from 'vitest';
import { EMPTY_ADD_FORM, addedAt, formFromDraft, planAdd, readAmount } from '../add-entry';

const calendar = createCalendar('Asia/Kuala_Lumpur');
const now = new Date('2026-10-14T06:30:00.000Z');
const CASH = '6f1c2a4e-8b3d-4c5f-9a7e-1d2b3c4d5e60';
const MAYBANK = '6f1c2a4e-8b3d-4c5f-9a7e-1d2b3c4d5e61';
const FOOD = '6f1c2a4e-8b3d-4c5f-9a7e-1d2b3c4d5e62';

const wallet = (id: string, name: string): FinanceWallet => ({
  id,
  userId: 'kai',
  name,
  type: 'cash',
  currency: 'MYR' as CurrencyCode,
  initialBalanceMinor: 0 as MinorAmount,
  color: null,
  icon: null,
  cardStyleId: null,
  isActive: true,
  displayOrder: 0,
  balanceConfirmedAt: null,
  notificationPackage: null,
  notificationAppLabel: null,
  notificationAccountHint: null,
  updatedAt: '2026-10-01T00:00:00.000Z',
});
const view = { walletsById: { [CASH]: wallet(CASH, 'Cash'), [MAYBANK]: wallet(MAYBANK, 'Maybank') } };
const ctx: PlanContext = { userId: 'kai', now: now.toISOString(), newId: () => 'new-row', isMigrated: () => true };

describe('readAmount', () => {
  it.each([
    ['12.50', 1250],
    ['1,200', 120000],
    [' 8 ', 800],
    ['', null],
    ['0', null],
    ['1.234', null],
    ['twelve', null],
  ])('%j reads as %j', (text, minor) => {
    expect(readAmount(text)).toBe(minor);
  });
});

describe('formFromDraft', () => {
  it("puts Moni's read in the Type it fields with its evidence", () => {
    expect(
      formFromDraft(
        {
          kind: 'expense',
          merchant: 'Mamak Ali',
          amountMinor: 1250 as MinorAmount,
          categoryId: FOOD,
          walletId: CASH,
          transactionDate: '2026-10-13T04:00:00.000Z',
          evidence: "You didn't say a wallet. Moni picked Cash.",
          itemCount: null,
        },
        calendar,
      ),
    ).toEqual({
      kind: 'expense',
      amount: '12.50',
      walletId: CASH,
      toWalletId: null,
      categoryId: FOOD,
      day: '2026-10-13',
      at: '2026-10-13T04:00:00.000Z',
      location: '',
      note: 'Mamak Ali',
      evidence: "You didn't say a wallet. Moni picked Cash.",
    });
  });
});

describe('addedAt', () => {
  it.each([
    [{ day: null, at: null }, '2026-10-14T06:30:00.000Z'],
    [{ day: '2026-10-14', at: null }, '2026-10-14T06:30:00.000Z'],
    [{ day: '2026-10-10', at: null }, '2026-10-09T16:00:00.000Z'],
    [{ day: '2026-10-13', at: '2026-10-13T04:00:00.000Z' }, '2026-10-13T04:00:00.000Z'],
    [{ day: '2026-10-12', at: '2026-10-13T04:00:00.000Z' }, '2026-10-11T16:00:00.000Z'],
  ])('%o is %s', (form, iso) => {
    expect(addedAt(form, calendar, now)).toBe(iso);
  });
});

describe('planAdd', () => {
  it('writes a typed expense as Manual, with its shop and place', () => {
    const plan = planAdd(
      { ...EMPTY_ADD_FORM, amount: '12.50', walletId: CASH, categoryId: FOOD, note: ' Mamak Ali ', location: 'SS2' },
      view,
      calendar,
      ctx,
      now,
    );
    expect(plan.kind === 'writes' && plan.writes.insert[0]?.row).toMatchObject({
      id: 'new-row',
      wallet_id: CASH,
      amount: '12.50',
      currency: 'MYR',
      type: 'expense',
      category_id: FOOD,
      merchant: 'Mamak Ali',
      location_name: 'SS2',
      transaction_date: '2026-10-14T06:30:00.000Z',
      metadata: { source: 'manual' },
    });
  });

  it('sources a form Moni filled to Moni', () => {
    const plan = planAdd({ ...EMPTY_ADD_FORM, amount: '5', walletId: CASH, evidence: 'Heard it.' }, view, calendar, ctx, now);
    expect(plan.kind === 'writes' && plan.writes.insert[0]?.row).toMatchObject({ metadata: { source: 'moni' } });
  });

  it('writes a transfer between two wallets with the note as its description', () => {
    const plan = planAdd({ ...EMPTY_ADD_FORM, kind: 'transfer', amount: '100', walletId: MAYBANK, toWalletId: CASH, note: 'ATM' }, view, calendar, ctx, now);
    expect(plan.kind === 'writes' && plan.writes.insert[0]?.row).toMatchObject({
      type: 'transfer',
      wallet_id: MAYBANK,
      transfer_to_wallet_id: CASH,
      description: 'ATM',
      merchant: null,
    });
  });

  it.each([
    [{ amount: '', walletId: CASH }, { kind: 'error', message: 'Enter an amount above zero.' }],
    [{ amount: '5', walletId: null }, { kind: 'needsInput', field: 'wallet' }],
    [{ amount: '5', walletId: CASH, kind: 'transfer' as const }, { kind: 'needsInput', field: 'destination' }],
    [{ amount: '5', walletId: CASH, toWalletId: CASH, kind: 'transfer' as const }, { kind: 'error', message: 'Pick two different wallets.' }],
  ])('asks before writing %o', (patch, answer) => {
    expect(planAdd({ ...EMPTY_ADD_FORM, ...patch }, view, calendar, ctx, now)).toEqual(answer);
  });
});
