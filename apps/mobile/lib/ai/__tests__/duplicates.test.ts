import { findDuplicate, type LedgerEntry } from '../duplicates';

const MAYBANK = 'wallet-maybank';
const TNG = 'wallet-tng';
const T0 = '2026-10-07T12:00:00.000Z';

function at(offsetMs: number): string {
  return new Date(Date.parse(T0) + offsetMs).toISOString();
}

function entry(over: Partial<LedgerEntry>): LedgerEntry {
  return {
    id: 'existing',
    kind: 'transaction',
    type: 'expense',
    walletId: MAYBANK,
    currency: 'MYR',
    amountMinor: 1250,
    merchant: 'FamilyMart',
    at: T0,
    ...over,
  };
}

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

describe('findDuplicate same_purchase', () => {
  const notification = entry({ id: 'notif', merchant: 'FamilyMart' });

  it('matches a receipt for the same amount 3 h later', () => {
    const receipt = entry({
      id: 'receipt',
      kind: 'proposal',
      merchant: 'FAMILYMART KLCC',
      at: at(3 * HOUR),
    });
    expect(findDuplicate(receipt, [notification])).toEqual({
      kind: 'same_purchase',
      target: notification,
      confidence: 'low',
      walletId: null,
      preferCandidate: false,
    });
  });

  it('ignores the same purchase 13 h apart', () => {
    const receipt = entry({ id: 'receipt', merchant: 'FAMILYMART KLCC', at: at(13 * HOUR) });
    expect(findDuplicate(receipt, [notification])).toBeNull();
  });

  it('ignores an amount 1 sen different', () => {
    const receipt = entry({ id: 'receipt', amountMinor: 1251, at: at(HOUR) });
    expect(findDuplicate(receipt, [notification])).toBeNull();
  });

  it('ignores different merchants', () => {
    const grab = entry({ id: 'grab', merchant: 'Grab', at: at(HOUR) });
    expect(findDuplicate(grab, [notification])).toBeNull();
  });

  it('does not tie two companies together by their shared SDN BHD suffix', () => {
    const other = entry({ id: 'other', merchant: 'KK SUPER MART SDN BHD' });
    const candidate = entry({ id: 'new', merchant: 'MR DIY TRADING SDN BHD', at: at(HOUR) });
    expect(findDuplicate(candidate, [other])).toBe(null);
  });

  it('matches when one merchant is unknown', () => {
    const manual = entry({ id: 'manual', merchant: null, at: at(2 * HOUR) });
    expect(findDuplicate(manual, [notification])).toEqual({
      kind: 'same_purchase',
      target: notification,
      confidence: 'low',
      walletId: null,
      preferCandidate: false,
    });
  });
});

describe('findDuplicate transfer_pair', () => {
  const maybankOut = entry({
    id: 'maybank',
    type: 'expense',
    walletId: MAYBANK,
    merchant: 'X',
    amountMinor: 100,
  });
  const tngIn = entry({
    id: 'tng',
    type: 'income',
    walletId: TNG,
    merchant: null,
    amountMinor: 100,
    at: at(2000),
  });

  it('pairs Maybank out with TNG in when TNG arrives second', () => {
    expect(findDuplicate(tngIn, [maybankOut])).toEqual({
      kind: 'transfer_pair',
      target: maybankOut,
      confidence: 'high',
      fromWalletId: MAYBANK,
      toWalletId: TNG,
    });
  });

  it('pairs Maybank out with TNG in when Maybank arrives second', () => {
    expect(findDuplicate(maybankOut, [tngIn])).toEqual({
      kind: 'transfer_pair',
      target: tngIn,
      confidence: 'high',
      fromWalletId: MAYBANK,
      toWalletId: TNG,
    });
  });

  it('ignores the pair 11 min apart', () => {
    expect(findDuplicate({ ...tngIn, at: at(11 * MINUTE) }, [maybankOut])).toBeNull();
  });

  it('ignores opposite directions in the same wallet', () => {
    expect(findDuplicate({ ...tngIn, walletId: MAYBANK }, [maybankOut])).toBeNull();
  });
});

describe('findDuplicate for a bank alert and an e-wallet alert', () => {
  const bankAlert = entry({
    id: 'bank',
    walletId: MAYBANK,
    merchant: 'TNG DIGITAL',
    fromAlert: true,
    side: 'bank',
    institutionId: 'maybank',
  });
  const tngAlert = entry({
    id: 'tng',
    walletId: TNG,
    merchant: 'GUARDIAN',
    fromAlert: true,
    side: 'ewallet',
    institutionId: 'tng',
    at: at(3 * MINUTE),
  });

  it.each([
    ['the e-wallet alert second', tngAlert, bankAlert, true],
    ['the bank alert second', bankAlert, tngAlert, false],
  ])('counts one purchase with %s', (_name, candidate, existing, preferCandidate) => {
    expect(findDuplicate(candidate, [existing])).toMatchObject({
      kind: 'same_purchase',
      target: existing,
      confidence: 'high',
      walletId: MAYBANK,
      preferCandidate,
    });
  });

  it('is confident only up to 10 minutes apart', () => {
    const tenMinutes = { ...tngAlert, at: at(10 * MINUTE) };
    const eleven = { ...tngAlert, at: at(11 * MINUTE) };
    expect(findDuplicate(tenMinutes, [bankAlert])?.confidence).toBe('high');
    expect(findDuplicate(eleven, [bankAlert])?.confidence).toBe('low');
  });

  it('asks up to an hour apart when the merchants disagree, then says nothing', () => {
    const shell = { ...bankAlert, merchant: 'SHELL' };
    expect(findDuplicate({ ...tngAlert, at: at(60 * MINUTE) }, [shell])?.confidence).toBe('low');
    expect(findDuplicate({ ...tngAlert, at: at(61 * MINUTE) }, [shell])).toBeNull();
  });

  it('asks when one alert names no merchant', () => {
    const blank = { ...bankAlert, merchant: null };
    expect(findDuplicate(tngAlert, [blank])?.confidence).toBe('low');
  });

  it('is confident when both name the same shop', () => {
    const guardian = { ...bankAlert, merchant: 'GUARDIAN MID VALLEY' };
    expect(findDuplicate(tngAlert, [guardian])?.confidence).toBe('high');
  });

  it('prefers the confident match over a closer guess', () => {
    const closer = entry({ id: 'manual', walletId: MAYBANK, merchant: null, at: at(3 * MINUTE) });
    expect(findDuplicate(tngAlert, [closer, bankAlert])).toMatchObject({
      target: bankAlert,
      confidence: 'high',
    });
  });

  it('never pairs a row that already counts two captures', () => {
    expect(findDuplicate(tngAlert, [{ ...bankAlert, paired: true }])).toBeNull();
    expect(findDuplicate({ ...tngAlert, paired: true }, [bankAlert])).toBeNull();
  });

  it('needs both alerts to be alerts, in two kinds of wallet', () => {
    expect(findDuplicate(tngAlert, [{ ...bankAlert, fromAlert: false }])).toBeNull();
    expect(findDuplicate(tngAlert, [{ ...bankAlert, side: 'ewallet' }])).toBeNull();
    expect(findDuplicate(tngAlert, [{ ...bankAlert, side: null }])).toBeNull();
  });
});

describe('findDuplicate selection', () => {
  it('returns the closest match in time', () => {
    const far = entry({ id: 'far', at: at(-5 * HOUR) });
    const near = entry({ id: 'near', at: at(-1 * HOUR) });
    const candidate = entry({ id: 'candidate' });
    expect(findDuplicate(candidate, [far, near])?.target.id).toBe('near');
  });

  it('ignores transfers, proposals without an amount, and itself', () => {
    const candidate = entry({ id: 'candidate' });
    const existing = [
      entry({ id: 'transfer', type: 'transfer', walletId: TNG }),
      entry({ id: 'pending', kind: 'proposal', amountMinor: null }),
      candidate,
    ];
    expect(findDuplicate(candidate, existing)).toBeNull();
  });
});
