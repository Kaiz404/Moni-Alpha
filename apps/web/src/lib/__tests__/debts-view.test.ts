import type { DebtLine, FinanceDebt, FinanceDebtActivity } from '@repo/core';
import type { CurrencyCode, MinorAmount } from '@repo/types';
import { describe, expect, it } from 'vitest';
import { comingUpWords, netLabel, openLabel, personMeta, repaidWords, timeline, writeOffWords } from '../debts-view';

const m = (value: number) => value as MinorAmount;

function debtLine(over: Partial<FinanceDebt>, money: Partial<DebtLine> = {}): DebtLine {
  return {
    debt: {
      id: 'd1',
      userId: 'u',
      counterpartyName: 'Aiman',
      direction: 'owed_to_me',
      currency: 'MYR' as CurrencyCode,
      dueDate: '2026-10-30',
      note: 'Penang trip hotel share',
      status: 'open',
      createdAt: '',
      updatedAt: '',
      ...over,
    },
    principalMinor: m(15000),
    repaidMinor: m(0),
    balanceMinor: m(15000),
    state: 'open',
    startedAt: '2026-09-27T04:00:00.000Z',
    lastAt: '2026-09-27T04:00:00.000Z',
    ...money,
  };
}

describe('debt words', () => {
  it('names the net position', () => {
    expect([m(11000), m(-4000), m(0)].map((netMinor) => netLabel({ netMinor }))).toEqual([
      'Overall, you are owed',
      'Overall, you owe',
      'Everyone is square',
    ]);
  });

  it('words Coming up from who pays whom', () => {
    expect(comingUpWords(debtLine({}), 16)).toEqual({ title: 'Aiman pays RM150', meta: 'In 16 days, penang trip hotel share' });
    expect(comingUpWords(debtLine({ counterpartyName: 'Mei', direction: 'i_owe', note: 'Concert tickets' }, { balanceMinor: m(4050) }), 1)).toEqual({
      title: 'Pay Mei RM40',
      meta: 'Tomorrow, concert tickets',
    });
    expect(comingUpWords(debtLine({ note: null }), -2)).toEqual({ title: 'Aiman pays RM150', meta: '2 days late' });
  });

  it('says when a debt started or how it closed', () => {
    expect(personMeta(debtLine({}), '2026-10-14', '2026-09-27')).toBe('Lent Sun 27 Sep');
    expect(personMeta(debtLine({ direction: 'i_owe' }), '2026-10-14', '2026-09-25')).toBe('Borrowed Fri 25 Sep');
    expect(personMeta(debtLine({ note: 'Lunch' }, { state: 'settled' }), '2026-10-14', '2026-09-01')).toBe('Settled, Lunch');
    expect(personMeta(debtLine({ note: null }, { state: 'written_off' }), '2026-10-14', '2026-09-01')).toBe('Written off');
  });

  it('counts people, not debts', () => {
    expect(openLabel([debtLine({}), debtLine({ id: 'd2' }), debtLine({ counterpartyName: 'Mei' })])).toBe('Open with 2 people');
    expect(openLabel([debtLine({})])).toBe('Open with 1 person');
  });

  it('says what came back and what is left', () => {
    expect(repaidWords(debtLine({}))).toEqual({ left: 'Nothing paid back yet', right: 'RM150.00 to go' });
    expect(repaidWords(debtLine({}, { repaidMinor: m(5000), balanceMinor: m(10000) }))).toEqual({
      left: 'RM50.00 of RM150.00 paid back',
      right: 'RM100.00 to go',
    });
  });

  it('lists the history newest first in the debt’s words', () => {
    const activity = (id: string, kind: FinanceDebtActivity['kind'], amount: number, date: string, walletId: string | null) =>
      ({ id, kind, amountMinor: m(amount), activityDate: date, walletId }) as FinanceDebtActivity;
    const items = timeline(
      debtLine({}),
      [activity('a1', 'principal', 15000, '2026-09-27T04:00:00Z', 'w1'), activity('a2', 'repayment', 5000, '2026-10-14T04:00:00Z', null)],
      { today: '2026-10-14', dayOf: (iso) => iso.slice(0, 10), walletName: (id) => (id === 'w1' ? 'Maybank' : null) },
    );
    expect(items.map(({ title, meta, amount }) => [title, meta, amount])).toEqual([
      ['Paid you back', 'Today', '+RM50.00'],
      ['Lent', 'Sun 27 Sep from Maybank', 'RM150.00'],
    ]);
  });
});

describe('writeOffWords', () => {
  it('says who stops owing, either way round', () => {
    expect(writeOffWords(debtLine({}, { balanceMinor: m(12000) }))).toEqual({
      title: 'Write off RM120.00?',
      line: "Aiman won't owe you anything. No money moves, and this history stays.",
    });
    expect(writeOffWords(debtLine({ direction: 'i_owe', counterpartyName: 'Mei' }, { balanceMinor: m(4050) }))).toEqual({
      title: 'Write off RM40.50?',
      line: "You won't owe Mei anything. No money moves, and this history stays.",
    });
  });
});
