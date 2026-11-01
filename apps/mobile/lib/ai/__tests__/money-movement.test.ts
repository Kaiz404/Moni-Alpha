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

describe('a credit-card bill payment', () => {
  const withCards: MovementWallet[] = [
    ...wallets,
    { id: 'visa', name: 'Maybank Visa', type: 'credit', currency: 'MYR', notificationPackage: 'com.maybank2u.life', notificationAccountHint: '1234' },
  ];
  const read = (
    text: string,
    walletId: string,
    type: 'income' | 'expense',
    list: MovementWallet[] = withCards,
  ) =>
    classifyMovement(
      { text, walletId, sourceApp: 'com.maybank2u.life', currency: 'MYR', type },
      list,
    );

  it.each([
    'MAYBANK: Payment of RM500.00 to Credit Card 5412****1234 on 14/10 successful.',
    'You have paid RM1,200.00 to your Maybank Credit Card ending 1234.',
    'Maybank2u: Credit Card Bill Payment of RM800.00 is successful.',
    'RM350.00 credit card payment to MAYBANK VISA ending 1234 successful.',
    'Bayaran kad kredit RM200.00 berjaya.',
    'Payment of RM300.00 for your card ending 1234 is successful.',
  ])('from the bank: %s', (text) => {
    expect(read(text, 'maybank', 'expense')).toEqual({
      kind: 'card_bill',
      fromWalletId: 'maybank',
      toWalletId: 'visa',
      label: 'Credit card payment',
      reason: 'Looks like a credit card payment from Maybank to Maybank Visa.',
      confidence: 'high',
    });
  });

  it.each([
    "We've received your credit card payment of RM500.00. Thank you.",
    'Payment of RM500.00 has been credited to your Maybank Credit Card.',
    'Thank you. Your payment of RM500.00 was received.',
  ])('from the issuer: %s', (text) => {
    expect(read(text, 'visa', 'income')).toMatchObject({
      kind: 'card_bill',
      fromWalletId: null,
      toWalletId: 'visa',
      confidence: 'low',
    });
  });

  it.each([
    ["MAYBANK: You've spent RM86.40 at JAYA GROCER with your credit card ending 1234.", 'visa', 'expense'],
    ['Payment of RM30.00 to GUARDIAN with credit card ending 1234 is successful.', 'visa', 'expense'],
    ['Credit card payment of RM45.00 at SHELL successful.', 'visa', 'expense'],
    ['Your credit card payment of RM500.00 is due on 20/10.', 'maybank', 'expense'],
    ['Minimum payment of RM50.00 for your credit card is due.', 'maybank', 'expense'],
    ['Annual fee of RM150.00 charged to your credit card.', 'visa', 'expense'],
    ['Refund of RM50.00 from LAZADA to your credit card ending 1234.', 'visa', 'income'],
  ] as const)('not a bill: %s', (text, walletId, type) => {
    expect(read(text, walletId, type)).toBeNull();
  });

  it('picks the card by its last digits among several', () => {
    const two = [
      ...withCards,
      { id: 'cimb-mc', name: 'CIMB Mastercard', type: 'credit', currency: 'MYR', notificationAccountHint: '8821' },
    ];
    expect(read('Payment of RM500.00 to Credit Card ending 8821 successful.', 'maybank', 'expense', two)).toMatchObject({
      toWalletId: 'cimb-mc',
      confidence: 'high',
    });
  });

  it('picks the card by the bank the alert names', () => {
    const two = [
      ...withCards,
      { id: 'cimb-mc', name: 'CIMB Mastercard', type: 'credit', currency: 'MYR' },
    ];
    expect(read('You have paid RM500.00 to your CIMB Credit Card.', 'maybank', 'expense', two)).toMatchObject({
      toWalletId: 'cimb-mc',
    });
  });

  it('asks when several cards fit', () => {
    const two = [
      ...withCards,
      { id: 'cimb-mc', name: 'CIMB Mastercard', type: 'credit', currency: 'MYR' },
    ];
    expect(read('Credit Card Bill Payment of RM800.00 is successful.', 'maybank', 'expense', two)).toMatchObject({
      fromWalletId: 'maybank',
      toWalletId: null,
      confidence: 'low',
    });
  });

  it('stays spending with no card to pay into, and says so', () => {
    expect(read('Credit Card Bill Payment of RM800.00 is successful.', 'maybank', 'expense', wallets)).toEqual({
      kind: 'card_bill',
      untracked: true,
      institutionId: null,
      reason: 'Looks like a credit card payment. Add the card as a wallet to count it as a transfer.',
    });
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

describe('a wallet linked to an app outside the institution table', () => {
  const free: MovementWallet[] = [
    { id: 'any', name: 'Any Bank', type: 'bank', currency: 'MYR', notificationPackage: 'com.example.anybank' },
    { id: 'pay', name: 'Any Pay', type: 'ewallet', currency: 'MYR', notificationPackage: 'com.example.anypay' },
    { id: 'jar', name: 'Jar', type: 'cash', currency: 'MYR', notificationPackage: 'com.example.jar' },
  ];
  const alert = (text: string, walletId: string, type: 'income' | 'expense' = 'expense') =>
    classifyMovement(
      { text, walletId, sourceApp: free.find((w) => w.id === walletId)!.notificationPackage!, currency: 'MYR', type },
      free,
    );

  it.each([
    ['You paid RM12.00 to KEDAI ABC.', 'any'],
    ['You paid RM12.00 to KEDAI ABC.', 'pay'],
    ['You paid RM12.00 to KEDAI ABC.', 'jar'],
  ])('leaves a plain payment alone: %s on %s', (text, walletId) => {
    expect(alert(text, walletId)).toBeNull();
  });

  it('reads a reload by the wallet type, named by the wallet', () => {
    expect(alert('Top up of RM50.00 successful.', 'pay', 'income')).toEqual({
      kind: 'reload',
      fromWalletId: null,
      toWalletId: 'pay',
      label: 'Any Pay reload',
      reason: 'Looks like a Any Pay reload. Which wallet paid for it?',
      confidence: 'low',
    });
  });
});
