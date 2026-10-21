import type { Observable } from '@legendapp/state';
import type { MinorAmount } from '@repo/types';

import { approve, later, laterUntil, notMine, undo } from '../review-actions';
import { listAwaitingReview } from '@/lib/supabase/proposed-transactions';

let mockNextId = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `id-${++mockNextId}` }));
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'user-1' }));
jest.mock('@/lib/notifications/capture-status', () => ({ markCaptureStatus: jest.fn() }));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return {
    wallets$: observable({}),
    transactions$: observable({}),
    proposedTransactions$: observable({}),
    autoAddRules$: observable({}),
    assertMigrated: () => {},
  };
});

type Rows = Observable<Record<string, Record<string, unknown>>>;
const { wallets$, transactions$, proposedTransactions$, autoAddRules$ } = jest.requireMock(
  '@/lib/store',
) as Record<'wallets$' | 'transactions$' | 'proposedTransactions$' | 'autoAddRules$', Rows>;

const MAYBANK = '00000000-0000-4000-8000-00000000000a';
const FOOD = '00000000-0000-4000-8000-0000000000f0';
const NOW = new Date('2026-10-14T04:41:00.000Z');

function seed(id: string, over: Record<string, unknown> = {}) {
  proposedTransactions$[id].set({
    id,
    user_id: 'user-1',
    source_type: 'notification',
    source_app: 'com.maybank2u.life',
    notification_body: "MAYBANK: You've spent RM12.00 at GRAB on 14/10 12:41.",
    amount: '12.00',
    currency: 'MYR',
    type: 'expense',
    merchant: 'GRAB',
    wallet_id: MAYBANK,
    category_id: FOOD,
    status: 'pending',
    created_at: '2026-10-14T04:41:00.000Z',
    deleted: false,
    ...over,
  });
  const proposal = listAwaitingReview(NOW).find((p) => p.id === id);
  if (!proposal) throw new Error(`seed ${id} is not awaiting review`);
  return proposal;
}

const ledger = () =>
  Object.values(transactions$.peek()).filter((row) => row.deleted === false);

beforeEach(() => {
  wallets$.set({ [MAYBANK]: { id: MAYBANK, currency: 'MYR', deleted: false } });
  transactions$.set({});
  proposedTransactions$.set({});
  autoAddRules$.set({});
});

describe('approve', () => {
  it('asks for a wallet and writes nothing when none is picked', async () => {
    const proposal = seed('p1', { wallet_id: null });

    const result = await approve(proposal, { walletId: null });

    expect(result).toEqual({ status: 'needsInput', field: 'wallet' });
    expect(ledger()).toEqual([]);
    expect(proposedTransactions$.p1.status.peek()).toBe('pending');
  });

  it('writes the edited amount, merchant and category to the ledger and closes the capture', async () => {
    const proposal = seed('p1');
    const statuses: unknown[] = [];
    const stop = proposedTransactions$.p1.status.onChange(({ value }) => statuses.push(value));

    const result = await approve(proposal, {
      amountMinor: 1550 as MinorAmount,
      merchant: 'Grab Food ',
    });
    stop();

    expect(result.status).toBe('done');
    expect(ledger()).toEqual([
      expect.objectContaining({
        amount: '15.50',
        merchant: 'Grab Food',
        category_id: FOOD,
        wallet_id: MAYBANK,
        type: 'expense',
      }),
    ]);
    expect(statuses).toEqual(['approved']);
    expect(listAwaitingReview(NOW)).toEqual([]);
  });

  it("adds an auto-add rule when Don't ask about similar is ticked", async () => {
    const proposal = seed('p1');

    await approve(proposal, { similar: true });

    expect(Object.values(autoAddRules$.peek())).toEqual([
      expect.objectContaining({
        merchant_key: 'grab',
        source_app: 'com.maybank2u.life',
        wallet_id: MAYBANK,
        category_id: FOOD,
        deleted: false,
      }),
    ]);
  });

  it('Undo removes the ledger row and the rule, and the capture waits for review again', async () => {
    const proposal = seed('p1');
    const result = await approve(proposal, { similar: true });
    if (result.status !== 'done') throw new Error(result.status);

    await undo(result.outcome);

    expect(ledger()).toEqual([]);
    expect(Object.values(autoAddRules$.peek())).toEqual([
      expect.objectContaining({ merchant_key: 'grab', deleted: true }),
    ]);
    expect(listAwaitingReview(NOW).map((p) => p.id)).toEqual(['p1']);
  });
});

describe('Not mine', () => {
  it('sets status to rejected, writes no ledger row, and Undo brings the capture back', async () => {
    const proposal = seed('p2');
    const statuses: unknown[] = [];
    const stop = proposedTransactions$.p2.status.onChange(({ value }) => statuses.push(value));

    const result = await notMine(proposal);
    stop();

    expect(statuses).toEqual(['rejected']);
    expect(ledger()).toEqual([]);
    expect(listAwaitingReview(NOW)).toEqual([]);

    if (result.status !== 'done') throw new Error(result.status);
    await undo(result.outcome);
    expect(listAwaitingReview(NOW).map((p) => p.id)).toEqual(['p2']);
  });
});

describe('Later', () => {
  it('snoozes until 8 am the next morning, local time', () => {
    const until = laterUntil(new Date(2026, 9, 14, 23, 30));
    expect(until).toEqual(new Date(2026, 9, 15, 8, 0, 0, 0));
  });

  it('stores the Later status and hides the capture until the snooze ends', async () => {
    const proposal = seed('p3');

    const result = await later(proposal, NOW);

    expect(result).toMatchObject({ status: 'done', outcome: { action: 'later' } });
    expect(proposedTransactions$.p3.status.peek()).toBe('later');
    expect(listAwaitingReview(NOW)).toEqual([]);
    expect(listAwaitingReview(laterUntil(NOW)).map((p) => p.id)).toEqual(['p3']);
  });
});
