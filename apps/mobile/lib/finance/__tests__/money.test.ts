import { decimalToMinor, formatMinorAmount, minorToDecimal } from '@repo/types';
import { outstandingDebtBalanceMinor, transactionDeltaMinor } from '../ledger';

describe('minor-unit money', () => {
  it('round-trips DECIMAL(12,2) values without float arithmetic', () => {
    expect(decimalToMinor('12.34')).toBe(1234);
    expect(decimalToMinor('0.1')).toBe(10);
    expect(minorToDecimal(1234)).toBe('12.34');
  });

  it('rejects values with unsupported precision', () => {
    expect(() => decimalToMinor('1.001')).toThrow('Invalid decimal amount');
    expect(() => decimalToMinor(1.005)).toThrow('Invalid decimal amount');
  });

  it('uses the transaction direction for each transfer endpoint', () => {
    const transfer = {
      walletId: 'from',
      transferToWalletId: 'to',
      amountMinor: 2500 as any,
      type: 'transfer' as const,
    };
    expect(transactionDeltaMinor(transfer, 'from')).toBe(-2500);
    expect(transactionDeltaMinor(transfer, 'to')).toBe(2500);
  });

  it('keeps debt principal and settlement activity exact', () => {
    expect(
      outstandingDebtBalanceMinor([
        { kind: 'principal', amountMinor: 10005 as any },
        { kind: 'repayment', amountMinor: 5000 as any },
      ]),
    ).toBe(5005);
  });

  it('formats only at the render boundary', () => {
    expect(formatMinorAmount(1234, 'USD')).toContain('12.34');
  });
});
