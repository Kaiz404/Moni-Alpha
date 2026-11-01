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
import { spendingMonth } from '@/lib/finance/activity-series';
import { buildBudgetMonth, monthKey } from '@/lib/finance/budget-month';
import { walletBalanceForTest } from './wallet-balance';
import { markCaptureStatus } from '@/lib/notifications/capture-status';
import { undoPairing } from '@/lib/proposals/pairing';
import { approve } from '@/lib/proposals/review-actions';
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

const BANK_RELOAD = "MAYBANK: RM100.00 transferred to Touch 'n Go eWallet on 14/10 12:41.";
const TNG_RELOAD = 'Reload of RM100.00 via Online Banking was successful.';
const BANK_CARD_RELOAD = "MAYBANK: You've spent RM100.00 at TNG DIGITAL on 14/10 12:41.";

const bankReload = (minutes = 0) =>
  delivered(MAYBANK_APP, BANK_RELOAD, { amount: 100, type: 'expense', merchant: "Touch 'n Go eWallet" }, minutes);
const tngReload = (minutes = 0) =>
  delivered(TNG_APP, TNG_RELOAD, { amount: 100, type: 'income', merchant: null }, minutes);
const bankCardReload = (minutes = 0) =>
  delivered(MAYBANK_APP, BANK_CARD_RELOAD, { amount: 100, type: 'expense', merchant: 'TNG DIGITAL' }, minutes);

function transferShape(row: Record<string, unknown>) {
  return {
    type: row.type,
    from: row.wallet_id,
    to: row.transfer_to_wallet_id,
    amount: row.amount,
    category: row.category_id ?? null,
    merchant: row.merchant ?? null,
  };
}

const RELOAD = {
  type: 'transfer',
  from: MAYBANK,
  to: TNG,
  amount: '100.00',
  category: null,
  merchant: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockModel();
  resetStore([
    wallet(MAYBANK, 'Maybank', 'bank', MAYBANK_APP),
    wallet(TNG, "Touch 'n Go", 'ewallet', TNG_APP),
    wallet(GRABPAY, 'GrabPay', 'ewallet', GRAB_APP),
  ]);
});

describe('a reload funded from a bank', () => {
  it('joins the ledger as a transfer, marked Auto, from the bank alert alone', async () => {
    const result = await run(bankReload());

    expect(result.transactionId).toBeTruthy();
    expect(openProposals()).toEqual([]);
    expect(ledgerRows().map(transferShape)).toEqual([RELOAD]);
    expect(ledgerRows()[0]).toMatchObject({
      description: "Touch 'n Go reload",
      metadata: { ai_suggested: true, source: 'notification' },
    });
  });

  it('waits in Review as a transfer from the e-wallet alert alone, asking which wallet paid', async () => {
    const result = await run(tngReload());

    expect(result.proposalId).toBeTruthy();
    expect(ledgerRows()).toEqual([]);
    expect(openProposals()[0]).toMatchObject({
      type: 'transfer',
      wallet_id: null,
      transfer_to_wallet_id: TNG,
      description: "Touch 'n Go reload",
      ai_reasoning: "Looks like a Touch 'n Go reload. Which wallet paid for it?",
    });
  });

  it.each([
    ['the bank alert first', bankReload, tngReload],
    ['the e-wallet alert first', tngReload, bankReload],
    ['the e-wallet alert, then the bank calling it a purchase', tngReload, bankCardReload],
    ['the bank calling it a purchase, then the e-wallet alert', bankCardReload, tngReload],
  ])('ends as one transfer with %s, minutes apart', async (_name, first, second) => {
    await run(first(0));
    await run(second(4));

    expect(openProposals()).toEqual([]);
    expect(ledgerRows().map(transferShape)).toEqual([RELOAD]);
  });

  it('folds into a row already auto-added as spending', async () => {
    seedRoutine(MAYBANK, 'TNG DIGITAL');
    const auto = await run(
      delivered(MAYBANK_APP, "MAYBANK: You've spent RM50.00 at TNG DIGITAL on 14/10 12:41.", {
        amount: 50,
        type: 'expense',
        merchant: 'TNG DIGITAL',
      }),
    );
    expect(store.transactions$[auto.transactionId!].peek()!.type).toBe('expense');

    await run(
      delivered(
        TNG_APP,
        'Reload of RM50.00 via your card was successful.',
        { amount: 50, type: 'income', merchant: null },
        3,
      ),
    );

    expect(transferShape(store.transactions$[auto.transactionId!].peek()!)).toEqual({
      ...RELOAD,
      amount: '50.00',
    });
    expect(openProposals()).toEqual([]);
  });

  it('folds into a row the user already approved', async () => {
    await run(tngReload(0));
    const [card] = listAwaitingReview(new Date(T0 + 1000));
    await approve(card!, { walletId: MAYBANK });
    expect(ledgerRows().map(transferShape)).toEqual([RELOAD]);

    await run(bankReload(2));

    expect(ledgerRows().map(transferShape)).toEqual([RELOAD]);
    expect(openProposals()).toEqual([]);
  });

  it('keeps the second alert in the log as Same payment', async () => {
    const first = await run(bankReload(0));
    const second = tngReload(2);
    await run(second);
    expect(markCaptureStatus).toHaveBeenCalledWith(
      second.id,
      'same_payment',
      first.transactionId,
      undefined,
    );
  });

  it('Undo on the completing alert returns the capture it completed to Review', async () => {
    const first = tngReload(0);
    await run(first);
    const second = bankReload(2);
    await run(second);
    expect(ledgerRows()).toHaveLength(1);

    await undoPairing(second.id);

    expect(ledgerRows()).toEqual([]);
    const cards = openProposals();
    expect(cards.map((row) => row.id).sort()).toEqual([first.id, second.id].sort());
    expect(cards.find((row) => row.id === first.id)).toMatchObject({
      type: 'transfer',
      wallet_id: null,
      transfer_to_wallet_id: TNG,
      pairing: null,
      status: 'pending',
    });
    expect(markCaptureStatus).toHaveBeenCalledWith(first.id, 'waiting_for_review');
    expect(markCaptureStatus).toHaveBeenLastCalledWith(second.id, 'waiting_for_review');
  });

  it('creates nothing when redelivered', async () => {
    await run(bankReload(0));
    await run(tngReload(2));

    await expect(run(bankReload(0))).resolves.toMatchObject({ created: false });
    await expect(run(tngReload(2))).resolves.toMatchObject({ created: false });

    expect(ledgerRows()).toHaveLength(1);
  });

  it('stays spending in Review when the user has no wallet for that e-wallet', async () => {
    resetStore([wallet(MAYBANK, 'Maybank', 'bank', MAYBANK_APP)]);
    await run(bankReload());

    expect(ledgerRows()).toEqual([]);
    expect(openProposals()[0]).toMatchObject({
      type: 'expense',
      wallet_id: MAYBANK,
      ai_reasoning:
        "Looks like a Touch 'n Go reload. Add a Touch 'n Go wallet to count it as a transfer.",
    });
  });

  it('asks in Review for a DuitNow transfer, and never adds it unasked', async () => {
    const result = await run(
      delivered(
        MAYBANK_APP,
        "MAYBANK: DuitNow transfer of RM50.00 to ALI BIN ABU (Touch 'n Go eWallet) successful.",
        { amount: 50, type: 'expense', merchant: 'ALI BIN ABU' },
      ),
    );
    expect(result.proposalId).toBeTruthy();
    expect(openProposals()[0]).toMatchObject({ type: 'transfer', wallet_id: MAYBANK, transfer_to_wallet_id: TNG });
  });

  it('leaves prepaid airtime as spending', async () => {
    await run(
      delivered(TNG_APP, 'Payment of RM30.00 for Hotlink Reload was successful.', {
        amount: 30,
        type: 'expense',
        merchant: 'Hotlink',
      }),
    );
    expect(openProposals()[0]).toMatchObject({ type: 'expense', wallet_id: TNG, merchant: 'Hotlink' });
  });
});

describe('spending totals', () => {
  const MYR = 'MYR' as CurrencyCode;
  const NOW = new Date(T0 + 60 * 60_000);

  it('leave the paired reload out on Home, Budget and Activity, and balances move', async () => {
    await run(bankReload(0));
    await run(tngReload(2));
    await run(
      delivered(MAYBANK_APP, "MAYBANK: You've spent RM12.00 at MAMAK on 14/10 13:00.", {
        amount: 12,
        type: 'expense',
        merchant: 'MAMAK',
      }, 20),
    );
    const [card] = listAwaitingReview(new Date(T0 + 30 * 60_000));
    await approve(card!);

    const rows = ledgerRows().flatMap((row) => toFinanceTransaction(row) ?? []);
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
    expect(rows).toHaveLength(2);
    expect(budget.spentMinor).toBe(1200);
    expect(spendingMonth(rows, budget, MYR, NOW).spentMinor).toBe(1200);
    const today = groupActivityDays(
      [...rows].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate)),
    )[0]!;
    expect(today.spentMinor).toBe(1200);
    expect(today.transactions.map((row) => row.type).sort()).toEqual(['expense', 'transfer']);
    expect(walletBalanceForTest(rows, MAYBANK)).toBe(-11200);
    expect(walletBalanceForTest(rows, TNG)).toBe(10000);
  });
});
