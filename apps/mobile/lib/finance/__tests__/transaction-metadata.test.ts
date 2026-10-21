import { createTransactionSchema, transactionMetadataSchema } from '@repo/types';

describe('transactionMetadataSchema', () => {
  it('keeps a known source', () => {
    expect(transactionMetadataSchema.parse({ source: 'voice' })).toEqual({ source: 'voice' });
  });

  it('rejects an unknown source', () => {
    expect(() => transactionMetadataSchema.parse({ source: 'sms' })).toThrow();
  });

  it('still parses rows written before sources existed', () => {
    expect(transactionMetadataSchema.parse({ ai_suggested: true })).toEqual({
      ai_suggested: true,
    });
  });

  it('marks a balance correction', () => {
    expect(transactionMetadataSchema.parse({ kind: 'balance_correction' })).toEqual({
      kind: 'balance_correction',
    });
    expect(() => transactionMetadataSchema.parse({ kind: 'refund' })).toThrow();
  });
});

describe('createTransactionSchema', () => {
  const correction = {
    walletId: '00000000-0000-4000-8000-00000000000a',
    amountMinor: 500,
    type: 'income',
    metadata: { kind: 'balance_correction' },
  };

  it('accepts a balance correction excluded from analysis', () => {
    expect(
      createTransactionSchema.safeParse({ ...correction, analysisExcluded: true }).success,
    ).toBe(true);
  });

  it('rejects a balance correction that would count as income or spending', () => {
    for (const analysisExcluded of [undefined, false]) {
      const result = createTransactionSchema.safeParse({ ...correction, analysisExcluded });
      expect(result.error?.issues.map((issue) => issue.message)).toEqual([
        'A balance correction must be excluded from analysis',
      ]);
    }
  });
});
