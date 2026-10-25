import type { MinorAmount } from '@repo/types';

import { transactionAlert } from '@/lib/transactions/alert';

describe('transactionAlert', () => {
  const alert = {
    text: "MAYBANK: You've spent RM30.40 at SHELL on 12/10 17:50.",
    amountMinor: 3040 as MinorAmount,
    currency: 'MYR',
  };

  it('reads the alert from synced metadata, as an object or a JSON string', () => {
    expect(transactionAlert({ source: 'notification', alert })).toEqual(alert);
    expect(transactionAlert(JSON.stringify({ source: 'notification', alert }))).toEqual(alert);
  });

  it('returns null for rows that kept no alert or a malformed one', () => {
    expect(transactionAlert({ source: 'notification' })).toBeNull();
    expect(transactionAlert({ alert: { ...alert, amountMinor: -5 } })).toBeNull();
    expect(transactionAlert('{not json')).toBeNull();
    expect(transactionAlert(null)).toBeNull();
  });
});
