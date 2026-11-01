import type { CurrencyCode } from '@repo/types';

import {
  delivered,
  GRAB_APP,
  GRABPAY,
  ledgerRows,
  MAYBANK,
  MAYBANK_APP,
  mockModel,
  openProposals,
  resetStore,
  run,
  seedRoutine,
  store,
  T0,
  TNG,
  TNG_APP,
  wallet,
} from './pairing-fixture';
import { toFinanceTransaction } from '@/lib/finance/adapters';
import { groupActivityDays } from '@/lib/finance/activity-filter';
import { buildBudgetMonth, monthKey } from '@/lib/finance/budget-month';
import type { FinanceTransaction } from '@/lib/finance/types';
import { markCaptureStatus } from '@/lib/notifications/capture-status';
import { undoPairing } from '@/lib/proposals/pairing';
import { approve, duplicateOf, notMine, undo } from '@/lib/proposals/review-actions';
import { listAwaitingReview } from '@/lib/supabase/proposed-transactions';

let mockNextId = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `00000000-0000-4000-a000-${String(++mockNextId).padStart(12, '0')}`,
}));
jest.mock('@/lib/ai/client', () => ({ getAiClient: jest.fn() }));
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'user-1' }));
jest.mock('@/lib/notifications/capture-status', () => ({
  markCaptureStatus: jest.fn(),
  captureStatusAfterExtraction: jest.fn(),
}));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return {
    wallets$: observable({}),
    transactions$: observable({}),
    categories$: observable({}),
    proposedTransactions$: observable({}),
    autoAddRules$: observable({}),
    assertMigrated: () => {},
    isMigrated: () => true,
  };
});

const BANK_ALERT = "MAYBANK: You've spent RM15.90 at TNG DIGITAL on 14/10 12:41.";
const TNG_ALERT = 'Payment of RM15.90 to GUARDIAN was successful.';

const bank = (minutes = 0) =>
  delivered(MAYBANK_APP, BANK_ALERT, { amount: 15.9, type: 'expense', merchant: 'TNG DIGITAL' }, minutes);
const ewallet = (minutes = 0) =>
  delivered(TNG_APP, TNG_ALERT, { amount: 15.9, type: 'expense', merchant: 'GUARDIAN' }, minutes);

function money(row: Record<string, unknown>) {
  return { wallet: row.wallet_id, merchant: row.merchant, amount: row.amount, type: row.type };
}

const ONE_PAYMENT = { wallet: MAYBANK, merchant: 'GUARDIAN', amount: '15.90', type: 'expense' };

beforeEach(() => {
  jest.clearAllMocks();
  mockModel();
  resetStore([
    wallet(MAYBANK, 'Maybank', 'bank', MAYBANK_APP),
    wallet(TNG, "Touch 'n Go", 'ewallet', TNG_APP),
    wallet(GRABPAY, 'GrabPay', 'ewallet', GRAB_APP),
  ]);
});

describe('one purchase, two alerts', () => {
  it.each([
    ['the bank alert', bank, ewallet],
    ['the e-wallet alert', ewallet, bank],
  ])('counts one capture in Review when %s arrives first', async (_name, first, second) => {
    await run(first(0));
    const result = await run(second(3));

    expect(result).toMatchObject({ created: true, paired: true });
    expect(ledgerRows()).toEqual([]);
    expect(openProposals().map(money)).toEqual([ONE_PAYMENT]);
  });

  it.each([
    ['the bank alert', bank, ewallet],
    ['the e-wallet alert', ewallet, bank],
  ])('folds into the ledger row after %s was approved', async (_name, first, second) => {
    await run(first(0));
    const [waiting] = listAwaitingReview(new Date(T0 + 1000));
    const approved = await approve(waiting!);
    expect(approved.status).toBe('done');

    await run(second(4));

    expect(openProposals()).toEqual([]);
    expect(ledgerRows()).toHaveLength(1);
    expect(ledgerRows()[0]).toMatchObject({ wallet_id: MAYBANK, amount: '15.90' });
  });

  it.each([
    ['the bank alert', bank, ewallet, MAYBANK, 'TNG DIGITAL'],
    ['the e-wallet alert', ewallet, bank, TNG, 'GUARDIAN'],
  ])('folds into the row auto-added from %s', async (_name, first, second, walletId, merchant) => {
    seedRoutine(walletId, merchant);
    const auto = await run(first(0));
    expect(auto.transactionId).toBeTruthy();
    const count = ledgerRows().length;

    await run(second(5));

    expect(ledgerRows()).toHaveLength(count);
    expect(openProposals()).toEqual([]);
    const row = store.transactions$[auto.transactionId!].peek()!;
    expect(money(row)).toEqual(ONE_PAYMENT);
    expect(row.metadata).toMatchObject({ pairing: { kind: 'same_purchase' } });
  });

  it('marks the folded alert Same payment, linked to the row that counts it', async () => {
    await run(bank(0));
    const second = ewallet(2);
    await run(second);

    const [held] = openProposals();
    expect(markCaptureStatus).toHaveBeenCalledWith(second.id, 'same_payment', undefined, held!.id);
    expect(held!.pairing).toMatchObject({
      absorbed: { id: second.id, notificationBody: TNG_ALERT, merchant: 'GUARDIAN' },
    });
  });

  it('asks instead of folding when the merchants disagree', async () => {
    await run(
      delivered(MAYBANK_APP, "MAYBANK: You've spent RM10.00 at SHELL on 14/10 12:41.", {
        amount: 10,
        type: 'expense',
        merchant: 'SHELL',
      }),
    );
    await run(
      delivered(
        TNG_APP,
        'Payment of RM10.00 to MPSJ PARKING was successful.',
        { amount: 10, type: 'expense', merchant: 'MPSJ PARKING' },
        4,
      ),
    );

    const cards = listAwaitingReview(new Date(T0 + 300_000));
    expect(cards).toHaveLength(2);
    await expect(duplicateOf(cards[0]!)).resolves.toMatchObject({
      kind: 'same_purchase',
      confidence: 'low',
    });
  });

  it('sends a routine alert to Review when it only suspects a duplicate', async () => {
    seedRoutine(MAYBANK, 'SHELL');
    await run(
      delivered(TNG_APP, 'Payment of RM30.00 to MPSJ PARKING was successful.', {
        amount: 30,
        type: 'expense',
        merchant: 'MPSJ PARKING',
      }),
    );
    const before = ledgerRows().length;
    const result = await run(
      delivered(
        MAYBANK_APP,
        "MAYBANK: You've spent RM30.00 at SHELL on 14/10 12:44.",
        { amount: 30, type: 'expense', merchant: 'SHELL' },
        3,
      ),
    );

    expect(result.proposalId).toBeTruthy();
    expect(ledgerRows()).toHaveLength(before);
    expect(openProposals()).toHaveLength(2);
  });

  it('keeps three identical payments from one app as three', async () => {
    const parking = (minutes: number) =>
      delivered(
        TNG_APP,
        'Payment of RM2.00 to MPSJ PARKING was successful.',
        { amount: 2, type: 'expense', merchant: 'MPSJ PARKING' },
        minutes,
      );
    await run(parking(0));
    await run(parking(1));
    await run(parking(2));
    expect(openProposals()).toHaveLength(3);
  });

  it('never counts three alerts as one', async () => {
    await run(bank(0));
    await run(ewallet(1));
    const third = await run(
      delivered(
        TNG_APP,
        'Payment of RM15.90 to GUARDIAN KLCC was successful.',
        { amount: 15.9, type: 'expense', merchant: 'GUARDIAN KLCC' },
        2,
      ),
    );

    expect(third.proposalId).toBeTruthy();
    expect(openProposals()).toHaveLength(2);
  });
});

describe('Undo', () => {
  it('makes the alert its own capture and puts the row back', async () => {
    await run(bank(0));
    const second = ewallet(2);
    await run(second);

    await expect(undoPairing(second.id)).resolves.toBe(true);

    const cards = openProposals();
    expect(cards.map((row) => row.notification_body).sort()).toEqual([BANK_ALERT, TNG_ALERT].sort());
    expect(cards.find((row) => row.notification_body === BANK_ALERT)).toMatchObject({
      merchant: 'TNG DIGITAL',
      wallet_id: MAYBANK,
      pairing: null,
    });
    expect(markCaptureStatus).toHaveBeenLastCalledWith(second.id, 'waiting_for_review');
  });

  it('restores an auto-added row and leaves its money alone', async () => {
    seedRoutine(TNG, 'GUARDIAN');
    const auto = await run(ewallet(0));
    const second = bank(2);
    await run(second);
    expect(store.transactions$[auto.transactionId!].peek()!.wallet_id).toBe(MAYBANK);

    await undoPairing(second.id);

    const row = store.transactions$[auto.transactionId!].peek()!;
    expect(money(row)).toEqual({ wallet: TNG, merchant: 'GUARDIAN', amount: '15.90', type: 'expense' });
    expect((row.metadata as { pairing?: unknown }).pairing).toBeUndefined();
    expect(openProposals().map((p) => p.id)).toEqual([second.id]);
  });

  it('finds nothing the second time', async () => {
    await run(bank(0));
    const second = ewallet(2);
    await run(second);
    await undoPairing(second.id);
    await expect(undoPairing(second.id)).resolves.toBe(false);
    expect(openProposals()).toHaveLength(2);
  });

  it('separates an approved pair once, leaving the approved row in the ledger', async () => {
    await run(bank(0));
    const second = ewallet(2);
    await run(second);
    const [card] = listAwaitingReview(new Date(T0 + 1000));
    await approve(card!);
    expect(ledgerRows()[0]!.metadata).toMatchObject({ pairing: { absorbed: { id: second.id } } });

    await expect(undoPairing(second.id)).resolves.toBe(true);

    expect(ledgerRows()[0]).toMatchObject({ merchant: 'TNG DIGITAL', wallet_id: MAYBANK });
    expect(openProposals().map((row) => row.id)).toEqual([second.id]);
    await expect(undoPairing(second.id)).resolves.toBe(false);
  });

  it('keeps the folded alert linked when an approved pair goes back to Review', async () => {
    await run(bank(0));
    const second = ewallet(2);
    await run(second);
    const [card] = listAwaitingReview(new Date(T0 + 1000));
    const approved = await approve(card!);
    if (approved.status !== 'done') throw new Error('not approved');

    await undo(approved.outcome);

    expect(ledgerRows()).toEqual([]);
    expect(markCaptureStatus).toHaveBeenLastCalledWith(second.id, 'same_payment', undefined, card!.id);
    expect(openProposals()).toHaveLength(1);
  });

  it('Not mine on the card takes the folded alert with it', async () => {
    await run(bank(0));
    const second = ewallet(2);
    await run(second);
    const [card] = listAwaitingReview(new Date(T0 + 1000));

    await notMine(card!);

    expect(markCaptureStatus).toHaveBeenCalledWith(second.id, 'ignored');
    expect(ledgerRows()).toEqual([]);
  });
});

describe('a redelivered notification', () => {
  it('creates nothing while the first waits in Review', async () => {
    await run(bank(0));
    await expect(run(bank(0))).resolves.toMatchObject({
      created: false,
      reason: 'Redelivered notification',
    });
    expect(openProposals()).toHaveLength(1);
  });

  it('creates nothing after the row was approved', async () => {
    await run(bank(0));
    const [card] = listAwaitingReview(new Date(T0 + 1000));
    await approve(card!);
    await expect(run(bank(0))).resolves.toMatchObject({ created: false });
    expect(ledgerRows()).toHaveLength(1);
    expect(openProposals()).toEqual([]);
  });

  it('creates nothing after it was auto-added, or folded into another row', async () => {
    seedRoutine(TNG, 'GUARDIAN');
    await run(ewallet(0));
    await run(bank(2));
    const rows = ledgerRows().length;

    await expect(run(ewallet(0))).resolves.toMatchObject({ created: false });
    await expect(run(bank(2))).resolves.toMatchObject({ created: false });

    expect(ledgerRows()).toHaveLength(rows);
    expect(openProposals()).toEqual([]);
  });

  it('reports what it did before when the same queue item runs twice', async () => {
    const item = bank(0);
    const first = await run(item);
    await expect(run(item)).resolves.toMatchObject({ proposalId: first.proposalId, created: true });
    expect(openProposals()).toHaveLength(1);
  });

  it('is recognised after Postgres rewrites the timestamp', async () => {
    const first = await run(bank(0));
    store.proposedTransactions$[first.proposalId!].assign({
      notification_received_at: '2026-10-14T04:41:00+00:00',
    });
    await expect(run(bank(0))).resolves.toMatchObject({ created: false });
  });

  it('is told apart from a second real payment with the same words', async () => {
    await run(bank(0));
    await run(bank(45));
    expect(openProposals()).toHaveLength(2);
  });
});

describe('spending totals', () => {
  const MYR = 'MYR' as CurrencyCode;
  const NOW = new Date(T0 + 60 * 60_000);

  const ledger = (): FinanceTransaction[] =>
    ledgerRows().flatMap((row) => toFinanceTransaction(row) ?? []);

  it('count the paired purchase once on Home, Budget and Activity', async () => {
    seedRoutine(TNG, 'GUARDIAN');
    await run(ewallet(0));
    await run(bank(2));

    const rows = ledger();
    const budget = buildBudgetMonth({
      month: monthKey(NOW),
      now: NOW,
      currency: MYR,
      transactions: rows,
      categories: [],
      budgets: [],
      monthlyTotalMinor: null,
      bills: [],
      debts: [],
    });
    expect(budget.spentMinor).toBe(3 * 2000 + 1590);
    const today = groupActivityDays(
      [...rows].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate)),
    )[0]!;
    expect(today.spentMinor).toBe(1590);
    expect(today.transactions).toHaveLength(1);
  });
});
