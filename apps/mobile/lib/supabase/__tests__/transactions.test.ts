import type { Observable } from '@legendapp/state';
import type { MinorAmount, ProposedTransaction } from '@repo/types';
import { approveProposedTransaction } from '../proposed-transactions';
import { createBalanceCorrection, createTransaction } from '../transactions';

let mockNextId = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `id-${++mockNextId}` }));
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'user-1' }));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return {
    wallets$: observable({ w1: { id: 'w1', currency: 'MYR', deleted: false } }),
    transactions$: observable({}),
    proposedTransactions$: observable({}),
  };
});

type Rows = Observable<Record<string, Record<string, unknown>>>;
const { transactions$, proposedTransactions$ } = jest.requireMock('@/lib/store') as {
  transactions$: Rows;
  proposedTransactions$: Rows;
};

const metadataOf = (id: string) => transactions$[id].metadata.peek();

describe('transaction source', () => {
  it('writes the source a manual entry passes', async () => {
    const created = await createTransaction(
      { walletId: 'w1', amountMinor: 1200 as MinorAmount, type: 'expense' },
      'manual',
    );
    expect(metadataOf(created.id)).toEqual({ source: 'manual' });
  });

  it('marks a balance correction and keeps it out of analysis', async () => {
    const created = await createBalanceCorrection('w1', 5000 as MinorAmount, 4200 as MinorAmount);
    expect(created).toMatchObject({ type: 'expense', amountMinor: 800, analysisExcluded: true });
    expect(metadataOf(created!.id)).toEqual({ source: 'manual', kind: 'balance_correction' });
    expect(await createBalanceCorrection('w1', 5000 as MinorAmount, 5000 as MinorAmount)).toBe(
      null,
    );
  });

  it.each([
    ['text', 'moni'],
    ['image', 'camera'],
    ['notification', 'notification'],
  ] as const)('an approved %s proposal becomes a %s transaction', async (sourceType, source) => {
    const proposal = {
      id: `p-${sourceType}`,
      sourceType,
      amountMinor: 600 as MinorAmount,
      type: 'expense',
      transferToWalletId: null,
      categoryId: null,
      description: 'Parking',
      merchant: 'KLCC',
      transactionDate: '2026-10-14T02:00:00.000Z',
    } as unknown as ProposedTransaction;
    proposedTransactions$[proposal.id].set({ id: proposal.id, deleted: false });

    const before = new Set(Object.keys(transactions$.peek()));

    await approveProposedTransaction(proposal, { walletId: 'w1' });

    const added = Object.keys(transactions$.peek()).filter((id) => !before.has(id));
    expect(added.map(metadataOf)).toEqual([{ source }]);
  });
});
