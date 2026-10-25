import type { Observable } from '@legendapp/state';
import type { MinorAmount } from '@repo/types';

import { approve, later, laterUntil, moveBackToReview, notMine, undo } from '../review-actions';
import {
  drainImageUploadQueue,
  enqueueImageUpload,
  getPendingUploadCount,
} from '@/lib/receipts/upload-queue';
import { listAwaitingReview, listRecentlyReviewed } from '@/lib/supabase/proposed-transactions';

let mockNextId = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `id-${++mockNextId}` }));
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'user-1' }));
jest.mock('@/lib/notifications/capture-status', () => ({ markCaptureStatus: jest.fn() }));
jest.mock('@/lib/receipts/images', () => ({
  saveImageLocally: jest.fn(),
  uploadReceiptImage: async (_local: string, userId: string, id: string) =>
    `https://cdn.test/receipts/${userId}/${id}.jpg`,
}));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return {
    wallets$: observable({}),
    transactions$: observable({}),
    proposedTransactions$: observable({}),
    autoAddRules$: observable({}),
    assertMigrated: () => {},
    isMigrated: () => true,
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

  it('keeps the bank alert on the ledger row with the amount the alert said, not the edit', async () => {
    const proposal = seed('p1');

    await approve(proposal, { amountMinor: 1550 as MinorAmount });

    expect(ledger()).toEqual([
      expect.objectContaining({
        metadata: {
          source: 'notification',
          alert: {
            text: "MAYBANK: You've spent RM12.00 at GRAB on 14/10 12:41.",
            amountMinor: 1200,
            currency: 'MYR',
          },
        },
      }),
    ]);
  });

  it('keeps no alert for a capture that did not come from a notification', async () => {
    const proposal = seed('p1', { source_type: 'text', notification_body: null });

    await approve(proposal);

    expect(ledger()).toEqual([expect.objectContaining({ metadata: { source: 'moni' } })]);
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

  it('keeps an uploaded receipt photo on the approved transaction', async () => {
    const photo = 'https://cdn.test/receipts/user-1/p1.jpg';
    const proposal = seed('p1', { source_type: 'image', source_image_uri: photo });

    await approve(proposal);

    expect(ledger()).toEqual([expect.objectContaining({ receipt_image_url: photo })]);
  });

  it('links a receipt photo that was still uploading to the transaction once it lands', async () => {
    const proposal = seed('p1', { source_type: 'image', source_image_uri: 'file:///receipts/p1.jpg' });
    enqueueImageUpload({
      target: 'proposal',
      id: 'p1',
      localUri: 'file:///receipts/p1.jpg',
      userId: 'user-1',
    });

    const result = await approve(proposal);
    if (result.status !== 'done') throw new Error(result.status);
    await drainImageUploadQueue();

    expect(ledger()).toEqual([
      expect.objectContaining({
        id: result.outcome.transactionId,
        receipt_image_url: `https://cdn.test/receipts/user-1/${result.outcome.transactionId}.jpg`,
      }),
    ]);
  });

  it('keeps a still-uploading photo across Approve, Undo and Approve, and drops the undone one', async () => {
    const local = 'file:///receipts/p1.jpg';
    const proposal = seed('p1', { source_type: 'image', source_image_uri: local });
    enqueueImageUpload({ target: 'proposal', id: 'p1', localUri: local, userId: 'user-1' });

    const first = await approve(proposal);
    if (first.status !== 'done') throw new Error(first.status);
    await undo(first.outcome);
    const second = await approve(proposal);
    if (second.status !== 'done') throw new Error(second.status);
    await drainImageUploadQueue();

    expect(ledger()).toEqual([
      expect.objectContaining({
        id: second.outcome.transactionId,
        receipt_image_url: `https://cdn.test/receipts/user-1/${second.outcome.transactionId}.jpg`,
      }),
    ]);
    expect(getPendingUploadCount()).toBe(0);
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
    expect(proposedTransactions$.p1.peek()).toMatchObject({
      status: 'pending',
      reviewed_at: null,
      transaction_id: null,
      deleted: false,
    });
    expect(listRecentlyReviewed()).toEqual([]);
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
    expect(proposedTransactions$.p2.peek()).toMatchObject({ status: 'pending', reviewed_at: null });
  });

  it('Move back to review puts a Not mine capture from Recently reviewed back in the deck', async () => {
    const { markCaptureStatus } = jest.requireMock('@/lib/notifications/capture-status') as {
      markCaptureStatus: jest.Mock;
    };
    await notMine(seed('p2'));
    const [reviewed] = listRecentlyReviewed();
    if (reviewed?.status !== 'rejected') throw new Error('expected a Not mine row');
    markCaptureStatus.mockClear();

    moveBackToReview({ ...reviewed, status: 'rejected' });

    expect(listAwaitingReview(NOW).map((p) => p.id)).toEqual(['p2']);
    expect(listRecentlyReviewed()).toEqual([]);
    expect(markCaptureStatus.mock.calls).toEqual([['p2', 'waiting_for_review']]);
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
