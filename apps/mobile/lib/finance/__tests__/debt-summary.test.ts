import type { CurrencyCode, MinorAmount } from '@repo/types';

import { summarizeDebts } from '../debt-summary';
import type { FinanceDebt, FinanceDebtActivity } from '../types';

const WED_14_OCT = new Date(2026, 9, 14, 14, 6);
const MYR = 'MYR' as CurrencyCode;

function debt(
  id: string,
  over: Partial<FinanceDebt> & Pick<FinanceDebt, 'direction'>,
): FinanceDebt {
  return {
    id,
    userId: 'kai',
    counterpartyName: id,
    currency: MYR,
    dueDate: null,
    note: null,
    status: 'open',
    ...over,
  };
}

let nextActivity = 1;
function activity(
  debtId: string,
  kind: FinanceDebtActivity['kind'],
  ringgit: number,
  activityDate: string,
): FinanceDebtActivity {
  return {
    id: `a${nextActivity++}`,
    userId: 'kai',
    debtId,
    kind,
    amountMinor: (ringgit * 100) as MinorAmount,
    activityDate,
    walletId: kind === 'write_off' ? null : 'maybank',
    cashTransactionId: null,
    note: null,
  };
}

describe('summarizeDebts', () => {
  it('nets a part-repaid loan against a debt due in 3 days', () => {
    const summary = summarizeDebts(
      [
        debt('Aiman', { direction: 'owed_to_me' }),
        debt('Mei', { direction: 'i_owe', dueDate: '2026-10-17' }),
      ],
      [
        activity('Aiman', 'principal', 100, '2026-09-27T04:00:00.000Z'),
        activity('Aiman', 'repayment', 20, '2026-10-01T04:00:00.000Z'),
        activity('Mei', 'principal', 40, '2026-09-25T04:00:00.000Z'),
      ],
      WED_14_OCT,
      MYR,
    );

    expect(summary.netMinor).toBe(4000);
    expect(summary.owedToMeMinor).toBe(8000);
    expect(summary.iOweMinor).toBe(4000);
    expect(
      summary.comingUp.map((row) => ({
        name: row.line.debt.counterpartyName,
        balance: row.line.balanceMinor,
        daysLeft: row.daysLeft,
      })),
    ).toEqual([{ name: 'Mei', balance: 4000, daysLeft: 3 }]);
    expect(summary.open.map((line) => line.debt.id)).toEqual(['Mei', 'Aiman']);
  });

  it('moves paid and written-off debts to the closed list, newest first', () => {
    const summary = summarizeDebts(
      [
        debt('Hana', { direction: 'owed_to_me', status: 'settled' }),
        debt('Ravi', { direction: 'i_owe', status: 'written_off' }),
      ],
      [
        activity('Hana', 'principal', 25, '2026-09-01T04:00:00.000Z'),
        activity('Hana', 'repayment', 25, '2026-09-03T04:00:00.000Z'),
        activity('Ravi', 'principal', 60, '2026-09-02T04:00:00.000Z'),
        activity('Ravi', 'write_off', 60, '2026-10-02T04:00:00.000Z'),
      ],
      WED_14_OCT,
      MYR,
    );

    expect(summary.closed.map((line) => [line.debt.id, line.state, line.principalMinor])).toEqual([
      ['Ravi', 'written_off', 6000],
      ['Hana', 'settled', 2500],
    ]);
    expect(summary.open).toEqual([]);
    expect(summary.netMinor).toBe(0);
  });

  it('leaves a debt in another currency out of every list and total', () => {
    const summary = summarizeDebts(
      [
        debt('Sam', { direction: 'owed_to_me', currency: 'USD' as CurrencyCode }),
        debt('Mei', { direction: 'i_owe' }),
      ],
      [
        activity('Sam', 'principal', 500, '2026-10-01T04:00:00.000Z'),
        activity('Mei', 'principal', 40, '2026-09-25T04:00:00.000Z'),
      ],
      WED_14_OCT,
      MYR,
    );

    expect(summary.open.map((line) => line.debt.id)).toEqual(['Mei']);
    expect(summary.owedToMeMinor).toBe(0);
    expect(summary.netMinor).toBe(-4000);
  });

  it('counts a debt late once its due day has passed', () => {
    const summary = summarizeDebts(
      [debt('Mei', { direction: 'i_owe', dueDate: '2026-10-12' })],
      [activity('Mei', 'principal', 40, '2026-09-25T04:00:00.000Z')],
      WED_14_OCT,
      MYR,
    );

    expect(summary.comingUp.map((row) => row.daysLeft)).toEqual([-2]);
  });
});
