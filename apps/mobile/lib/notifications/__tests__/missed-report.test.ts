import { walletForApp } from '../missed-report';

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
