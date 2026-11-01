import { classifyMovement, type MovementWallet } from '../money-movement';
import { KNOWN_INSTITUTIONS, type Institution } from '../institutions';

const wallets: MovementWallet[] = [
  { id: 'maybank', name: 'Maybank', type: 'bank', currency: 'MYR', notificationPackage: 'com.maybank2u.life' },
  { id: 'cimb', name: 'CIMB Savings', type: 'bank', currency: 'MYR', notificationPackage: 'com.cimb.cimbocto' },
  { id: 'tng', name: "Touch 'n Go", type: 'ewallet', currency: 'MYR', notificationPackage: 'my.com.tngdigital.ewallet' },
  { id: 'grab', name: 'GrabPay', type: 'ewallet', currency: 'MYR', notificationPackage: 'com.grabtaxi.passenger' },
  { id: 'cash', name: 'Cash', type: 'cash', currency: 'MYR', notificationPackage: null },
];

const fromBank = (text: string, walletId = 'maybank') =>
  classifyMovement(
    { text, walletId, sourceApp: 'com.maybank2u.life', currency: 'MYR', type: 'expense' },
    wallets,
  );
const fromEwallet = (text: string, walletId = 'tng', type: 'income' | 'expense' = 'income') =>
  classifyMovement(
    { text, walletId, sourceApp: 'my.com.tngdigital.ewallet', currency: 'MYR', type },
    wallets,
  );

describe('a reload read from the bank', () => {
  it.each([
    ["MAYBANK: RM100.00 transferred to Touch 'n Go eWallet on 13/10 19:00.", 'tng', "Touch 'n Go reload"],
    ['MAYBANK2U: You have transferred RM50.00 to TNG DIGITAL SDN BHD on 14/10.', 'tng', "Touch 'n Go reload"],
    ['Maybank: FPX payment of RM30.00 to Touch n Go eWallet is successful.', 'tng', "Touch 'n Go reload"],
    ['MAYBANK: Reload of RM20.00 to GrabPay successful.', 'grab', 'GrabPay reload'],
    ['Maybank: RM40.00 top-up to GRABPAY via Maybank2u is successful.', 'grab', 'GrabPay reload'],
  ])('%s', (text, to, label) => {
    expect(fromBank(text)).toEqual({
      kind: 'reload',
      fromWalletId: 'maybank',
      toWalletId: to,
      label,
      reason: `Looks like a ${label} from Maybank.`,
      confidence: 'high',
    });
  });

  it('asks about DuitNow, which can go to a friend', () => {
    expect(fromBank("DuitNow transfer of RM50.00 to ALI BIN ABU (Touch 'n Go eWallet) successful.")).toMatchObject({
      kind: 'reload',
      toWalletId: 'tng',
      confidence: 'low',
    });
  });

  it('asks which wallet when the app links two', () => {
    const two = [...wallets, { ...wallets[2]!, id: 'tng-2', name: 'TNG Backup' }];
    expect(
      classifyMovement(
        {
          text: "RM100.00 transferred to Touch 'n Go eWallet.",
          walletId: 'maybank',
          sourceApp: 'com.maybank2u.life',
          currency: 'MYR',
          type: 'expense',
        },
        two,
      ),
    ).toMatchObject({ toWalletId: null, fromWalletId: 'maybank', confidence: 'low' });
  });

  it('stays spending with no wallet for that e-wallet, and says so', () => {
    const noTng = wallets.filter((w) => w.id !== 'tng');
    expect(
      classifyMovement(
        {
          text: "MAYBANK: RM100.00 transferred to Touch 'n Go eWallet on 13/10 19:00.",
          walletId: 'maybank',
          sourceApp: 'com.maybank2u.life',
          currency: 'MYR',
          type: 'expense',
        },
        noTng,
      ),
    ).toEqual({
      kind: 'reload',
      untracked: true,
      institutionId: 'tng',
      reason: "Looks like a Touch 'n Go reload. Add a Touch 'n Go wallet to count it as a transfer.",
    });
  });
});

describe('a reload read from the e-wallet', () => {
  it.each([
    'Reload of RM100.00 via Online Banking was successful.',
    'You have successfully reloaded RM100.00 into your eWallet.',
    'Top up of RM100.00 successful. Your new balance is RM120.50.',
    "You've topped up RM100.00 to your wallet.",
  ])('%s', (text) => {
    expect(fromEwallet(text)).toMatchObject({
      kind: 'reload',
      fromWalletId: null,
      toWalletId: 'tng',
      confidence: 'low',
    });
  });

  it('names the bank when the alert does', () => {
    expect(fromEwallet('Reload of RM100.00 via FPX Maybank2u was successful.')).toEqual({
      kind: 'reload',
      fromWalletId: 'maybank',
      toWalletId: 'tng',
      label: "Touch 'n Go reload",
      reason: "Looks like a Touch 'n Go reload from Maybank.",
      confidence: 'high',
    });
  });

  it('reads the same whichever type the model picked', () => {
    expect(fromEwallet('Reload of RM20.00 was successful.', 'tng', 'expense')).toMatchObject({
      toWalletId: 'tng',
    });
  });
});

describe('not a reload', () => {
  it.each([
    ["MAYBANK: You've spent RM15.90 at TNG DIGITAL on 14/10 12:41."],
    ["MAYBANK: You've spent RM23.40 at GRAB*FOOD on 14/10 12:41."],
    ['MAYBANK: You have transferred RM50.00 to ALI BIN ABU on 14/10.'],
    ['MAYBANK: Hotlink reload RM30.00 successful.'],
    ['MAYBANK: Reload RM30.00 for mobile 0123456789 (Digi prepaid) successful.'],
  ])('%s', (text) => {
    expect(fromBank(text)).toBeNull();
  });

  it.each([
    ['Payment of RM15.90 to GUARDIAN was successful.'],
    ['Payment of RM30.00 for Hotlink Reload was successful.'],
    ['RM10.00 from your eWallet was used to reload your TNG card (RFID).'],
    ['You have reloaded RM50.00 to GO+.'],
    ['Refund of RM20.00 for your reload.'],
    ['RM30.00 received from ALI BIN ABU.'],
  ])('%s', (text) => {
    expect(fromEwallet(text)).toBeNull();
  });

  it('leaves a cash wallet alone', () => {
    expect(fromBank('Reload RM10 at TNG', 'cash')).toBeNull();
  });
});

describe('the table', () => {
  it('reads a new bank from its one row', () => {
    const table: Institution[] = [
      ...KNOWN_INSTITUTIONS,
      { id: 'mbsb', name: 'MBSB', kind: 'bank', packages: ['com.mbsb.mobile'], names: ['mbsb'] },
    ];
    const withMbsb = [...wallets, { id: 'mbsb', name: 'My savings', type: 'other', currency: 'MYR', notificationPackage: 'com.mbsb.mobile' }];
    expect(
      classifyMovement(
        {
          text: "MBSB: RM70.00 transferred to Touch 'n Go eWallet.",
          walletId: 'mbsb',
          sourceApp: 'com.mbsb.mobile',
          currency: 'MYR',
          type: 'expense',
        },
        withMbsb,
        table,
      ),
    ).toMatchObject({ fromWalletId: 'mbsb', toWalletId: 'tng', confidence: 'high' });
  });
});
