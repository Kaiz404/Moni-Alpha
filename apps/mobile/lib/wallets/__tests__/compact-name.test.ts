import { compactWalletName, compactWalletNames } from '@/lib/wallets/compact-name';

describe('compactWalletName', () => {
  it.each([
    ['Maybank Savings', 'Maybank'],
    ["Touch 'n Go eWallet", "Touch 'n Go"],
    ['Cash', 'Cash'],
    ['Wise USD', 'Wise USD'],
    ['CIMB Current', 'CIMB'],
    ['CIMB Current Account', 'CIMB'],
    ['Public Bank Saving Acct', 'Public Bank'],
    ['MAYBANK SAVINGS', 'MAYBANK'],
    ['GrabPay e-wallet', 'GrabPay'],
    ['Boost E-Wallet', 'Boost'],
    ['ShopeePay E Wallet', 'ShopeePay'],
    ['BigPay Wallet', 'BigPay'],
    ['Maybank - Savings', 'Maybank'],
    ['  RHB Savings  ', 'RHB'],
    ['Savings', 'Savings'],
    ['Wallet', 'Wallet'],
    ['Savings Account', 'Savings'],
    ['- Savings', '- Savings'],
    ['Mywallet', 'Mywallet'],
    ['Savings Goal', 'Savings Goal'],
    ['Current Fund', 'Current Fund'],
  ])('reads %s as %s', (full, compact) => {
    expect(compactWalletName(full)).toBe(compact);
  });
});

describe('compactWalletNames', () => {
  const names = (...list: string[]) =>
    compactWalletNames(list.map((name, index) => ({ id: String(index), name })));

  it.each([
    [['Maybank Savings', "Touch 'n Go eWallet", 'Cash'], ['Maybank', "Touch 'n Go", 'Cash']],
    [['Maybank Savings', 'Maybank Current', 'Cash'], ['Maybank Savings', 'Maybank Current', 'Cash']],
    [['Maybank Savings', 'Maybank'], ['Maybank Savings', 'Maybank']],
    [['MAYBANK SAVINGS', 'maybank current'], ['MAYBANK SAVINGS', 'maybank current']],
    [['Cash', 'Cash'], ['Cash', 'Cash']],
    [[], []],
  ])('reads %j as %j', (full, compact) => {
    expect(names(...full)).toEqual(Object.fromEntries(compact.map((name, i) => [String(i), name])));
  });
});
