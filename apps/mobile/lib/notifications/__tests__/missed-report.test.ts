import { prefillFromAlert, walletForApp } from '../missed-report';

const receivedAt = new Date(2026, 9, 14, 12, 41).toISOString();

describe('prefillFromAlert', () => {
  it('reads a Maybank spend alert', () => {
    expect(
      prefillFromAlert("MAYBANK: You've spent RM1,023.40 at GRAB*FOOD on 14/10 12:41.", receivedAt),
    ).toEqual({ amount: '1023.40', note: 'GRAB*FOOD', date: '2026-10-14' });
  });

  it('reads a Touch n Go payment', () => {
    expect(prefillFromAlert('Payment of RM15.90 to GUARDIAN was successful.', receivedAt)).toEqual({
      amount: '15.90',
      note: 'GUARDIAN',
      date: '2026-10-14',
    });
  });

  it('reads money in as income', () => {
    expect(prefillFromAlert('RM200.00 received from AHMAD.', receivedAt)).toEqual({
      amount: '200.00',
      note: 'AHMAD',
      date: '2026-10-14',
      type: 'income',
    });
  });

  it('reads a Malay alert', () => {
    expect(prefillFromAlert('Bayaran RM45.00 kepada 99 SPEEDMART berjaya.', receivedAt)).toEqual({
      amount: '45.00',
      note: '99 SPEEDMART',
      date: '2026-10-14',
    });
  });

  it('leaves out what the alert does not say', () => {
    expect(prefillFromAlert('Your statement is ready', 'not a date')).toEqual({});
  });
});

describe('walletForApp', () => {
  const wallets = [
    { id: 'cash', notificationPackage: null },
    { id: 'tng', notificationPackage: 'my.com.tngdigital.ewallet' },
  ];

  it('finds a wallet by the app it reads, across package aliases', () => {
    expect(walletForApp('com.tngdigital.ewallet', wallets)?.id).toBe('tng');
  });

  it('finds none for an app nothing reads', () => {
    expect(walletForApp('com.maybank2u.life', wallets)).toBeUndefined();
  });
});
