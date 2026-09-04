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
      fromWalletId: MAYBANK,
      toWalletId: TNG,
    });
  });

  it('pairs Maybank out with TNG in when Maybank arrives second', () => {
    expect(findDuplicate(maybankOut, [tngIn])).toEqual({
      kind: 'transfer_pair',
      target: tngIn,
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
