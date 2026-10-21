import { transactionMetadataSchema } from '@repo/types';

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
