import type { DebtLine, FinanceDebt, FinanceDebtActivity } from '@repo/core';
import type { CurrencyCode, MinorAmount } from '@repo/types';
import { describe, expect, it } from 'vitest';
import {
  comingUpWords,
  netLabel,
  NO_WALLET,
  openLabel,
  owedBar,
  peopleView,
  personMeta,
  repaidWords,
  repayAction,
  repayWallet,
  sideOptions,
  statusOptions,
  timeline,
  WALLET_WORDS,
  walletField,
  writeOffWords,
} from '../debts-view';

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
    noted: false,
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

describe('debts that moved no money', () => {
  it('says Noted on the row instead of Lent or Borrowed', () => {
    expect(personMeta(debtLine({}, { noted: true }), '2026-10-14', '2026-10-01')).toBe('Noted Thu 1 Oct');
    expect(personMeta(debtLine({ direction: 'i_owe' }, { noted: true }), '2026-10-14', '2026-10-01')).toBe('Noted Thu 1 Oct');
  });

  it('words a history with no wallet as the phone does', () => {
    const principal = { id: 'a1', kind: 'principal', amountMinor: m(5000), activityDate: '2026-10-01T04:00:00Z', walletId: null } as FinanceDebtActivity;
    const words = (line: DebtLine) =>
      timeline(line, [principal], { today: '2026-10-14', dayOf: (iso) => iso.slice(0, 10), walletName: () => null }).map(({ title, meta }) => [title, meta]);
    expect(words(debtLine({}))).toEqual([['Lent', 'Thu 1 Oct']]);
    expect(words(debtLine({ direction: 'i_owe', counterpartyName: 'Mei' }))).toEqual([['Borrowed', 'Thu 1 Oct, Mei paid directly']]);
  });

  it('shows Wallet: Not used for no wallet, the side label and the wallet otherwise', () => {
    const name = (id: string) => (id === 'w1' ? 'Maybank' : undefined);
    expect(walletField('Lent from', NO_WALLET, name)).toEqual({ label: 'Wallet', value: 'Not used' });
    expect(walletField('Lent from', 'w1', name)).toEqual({ label: 'Lent from', value: 'Maybank' });
    expect(walletField('Paid into', null, name)).toEqual({ label: 'Paid into', value: null });
  });

  it('puts the no-money choice in each side’s words', () => {
    expect(WALLET_WORDS.owed_to_me).toEqual({ principal: 'Lent from', repay: 'Paid into', principalNone: "Money didn't leave my wallet", repayNone: "Money didn't reach my wallet" });
    expect(WALLET_WORDS.i_owe).toEqual({ principal: 'Borrowed into', repay: 'Paid from', principalNone: "Money didn't reach my wallet", repayNone: "Money didn't leave my wallet" });
  });

  it('starts a repayment on the wallet the debt used, unchosen for a noted debt, else the usual one', () => {
    expect(repayWallet({ noted: true }, [{ walletId: null }, { walletId: 'w2' }], ['w1', 'w2'], 'w1')).toBe('w2');
    expect(repayWallet({ noted: true }, [{ walletId: null }], ['w1'], 'w1')).toBeNull();
    expect(repayWallet({ noted: false }, [{ walletId: 'gone' }], ['w1'], 'w1')).toBe('w1');
  });

  it('asks where the money went before it records', () => {
    expect(repayAction(null, 'w1')).toBe('Add an amount');
    expect(repayAction('RM50.00', null)).toBe('Choose where it went');
    expect(repayAction('RM50.00', NO_WALLET)).toBe('Record RM50.00');
  });
});

describe('the hero and the People pickers', () => {
  const aiman = debtLine({});
  const mei = debtLine({ id: 'd2', counterpartyName: 'Mei', direction: 'i_owe' }, { balanceMinor: m(4000) });
  const hana = debtLine({ id: 'd3', counterpartyName: 'Hana' }, { state: 'settled' });
  const summary = {
    open: [aiman, mei],
    closed: [hana],
    comingUp: [aiman, mei].map((line) => ({ line, dueDate: '2026-10-30', daysLeft: 16 })),
    owedToMeMinor: m(15000),
    iOweMinor: m(4050),
    currency: 'MYR',
  };
  const names = (lines: readonly DebtLine[]) => lines.map((line) => line.debt.counterpartyName);

  it('sizes owed against owe and leaves out an empty side', () => {
    expect(owedBar({ owedToMeMinor: m(15000), iOweMinor: m(4000) })).toEqual([
      { side: 'owed_to_me', flex: 15000 },
      { side: 'i_owe', flex: 4000 },
    ]);
    expect(owedBar({ owedToMeMinor: m(0), iOweMinor: m(4000) })).toEqual([{ side: 'i_owe', flex: 4000 }]);
    expect(owedBar({ owedToMeMinor: m(0), iOweMinor: m(0) })).toBeNull();
  });

  it('filters People and Coming up by side, and People by status', () => {
    expect(names(peopleView(summary, 'all', 'open').lines)).toEqual(['Aiman', 'Mei']);
    expect(names(peopleView(summary, 'i_owe', 'open').lines)).toEqual(['Mei']);
    expect(peopleView(summary, 'i_owe', 'open').comingUp.map((row) => row.line.debt.counterpartyName)).toEqual(['Mei']);
    expect(names(peopleView(summary, 'all', 'closed').lines)).toEqual(['Hana']);
    expect(names(peopleView(summary, 'i_owe', 'closed').lines)).toEqual([]);
  });

  it('gives each choice the phone’s meta', () => {
    expect(sideOptions(summary)).toEqual([
      { value: 'all', label: 'Everyone', meta: '2 people' },
      { value: 'owed_to_me', label: 'Owed to you', meta: 'RM150' },
      { value: 'i_owe', label: 'You owe', meta: 'RM40.50' },
    ]);
    expect(statusOptions(summary)).toEqual([
      { value: 'open', label: 'Open', meta: '2 people' },
      { value: 'closed', label: 'Settled and written off', meta: '1 person' },
    ]);
  });
});
