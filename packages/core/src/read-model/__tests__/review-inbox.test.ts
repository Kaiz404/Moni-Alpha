import type { MinorAmount, ProposedTransaction } from '@repo/types';
import { describe, expect, it } from 'vitest';

import { createCalendar } from '../../calendar';
import { approvedRow, inboxOrder, merchantHistory, reviewedLately, reviewStatus, similarMatches, type ReviewedProposal } from '../review-inbox';
import type { FinanceTransaction } from '../types';

const KL = createCalendar('Asia/Kuala_Lumpur');
const UTC = createCalendar('UTC');

const capture = (over: Partial<ProposedTransaction> = {}): ProposedTransaction => ({
  id: 'p-1',
  userId: 'user-1',
  sourceType: 'notification',
  sourceApp: 'com.maybank2u.life',
  sourceText: null,
  sourceImageUri: null,
  notificationTitle: 'Maybank',
  notificationBody: 'You spent RM23.40 at GRAB*FOOD',
  notificationReceivedAt: '2026-10-14T04:41:00.000Z',
  aiReasoning: null,
  aiConfidence: 0.94,
  walletId: 'w-maybank',
  walletHint: null,
  transferToWalletId: null,
  transferToWalletHint: null,
  amountMinor: 2340 as MinorAmount,
  currency: 'MYR',
  type: 'expense',
  description: null,
  merchant: 'GRAB*FOOD',
  categoryId: 'c-food',
  categoryHint: null,
  transactionDate: '2026-10-14T04:41:00.000Z',
  createdAt: '2026-10-14T04:41:05.000Z',
  updatedAt: '2026-10-14T04:41:05.000Z',
  status: 'pending',
  reviewedAt: null,
  transactionId: null,
  pairing: null,
  ...over,
});

const row = (id: string, at: string, over: Partial<FinanceTransaction> = {}) =>
  ({
    id,
    type: 'expense',
    currency: 'MYR',
    merchant: 'GRAB*FOOD',
    walletId: 'w-maybank',
    categoryId: 'c-food',
    analysisExcluded: false,
    debtActivityId: null,
    transactionDate: at,
    metadata: { source: 'notification', alert: { text: `alert ${id}` } },
    ...over,
  }) as FinanceTransaction;

describe('reviewStatus', () => {
  const plain = { hasWallet: true, paired: false, maybeDuplicate: false, timesFiled: 0 };

  it('puts a missing wallet first, then a pairing or a likely duplicate, then how familiar the merchant is', () => {
    expect(
      [
        { hasWallet: false, paired: true, timesFiled: 14 },
        { paired: true, timesFiled: 14 },
        { maybeDuplicate: true, timesFiled: 14 },
        { timesFiled: 3 },
        { timesFiled: 2 },
        { timesFiled: 0 },
      ].map((facts) => reviewStatus({ ...plain, ...facts })),
    ).toEqual([
      { tone: 'near', label: 'Needs a wallet' },
      { tone: 'review', label: 'Same payment' },
      { tone: 'review', label: 'Maybe a duplicate' },
      { tone: 'onTrack', label: 'Usual for you' },
      { tone: 'onTrack', label: 'Seen before' },
      null,
    ]);
  });
});

describe('reviewedLately', () => {
  it('keeps 30 days of Approve and Not mine, newest first, and nothing still waiting', () => {
    const now = new Date('2026-10-14T07:00:00.000Z');
    const list = reviewedLately(
      [
        capture({ id: 'waiting' }),
        capture({ id: 'old', status: 'approved', reviewedAt: '2026-09-13T06:00:00.000Z' }),
        capture({ id: 'month', status: 'rejected', reviewedAt: '2026-09-15T06:00:00.000Z' }),
        capture({ id: 'today', status: 'approved', reviewedAt: '2026-10-14T05:00:00.000Z' }),
        capture({ id: 'no-time', status: 'approved', reviewedAt: null }),
      ],
      now,
    );
    expect(list.map((proposal) => [proposal.id, proposal.status])).toEqual([
      ['today', 'approved'],
      ['month', 'rejected'],
    ]);
  });
});

describe('similarMatches', () => {
  const history = [
    row('t-13', '2026-10-13T04:35:00.000Z'),
    row('t-07', '2026-10-07T04:30:00.000Z'),
    row('t-other-app', '2026-10-06T04:30:00.000Z', {
      metadata: { source: 'notification', alert: { text: 'x', key: '["com.cimb","CIMB","x",1]' } },
    }),
    row('t-same-app', '2026-10-05T04:30:00.000Z', {
      walletId: 'w-tng',
      metadata: { source: 'notification', alert: { text: 'x', key: '["com.maybank2u.life","Maybank","x",1]' } },
    }),
    row('t-typed', '2026-10-04T04:30:00.000Z', { metadata: { source: 'manual' } }),
    row('t-september', '2026-09-30T04:30:00.000Z'),
    row('t-other-wallet', '2026-10-03T04:30:00.000Z', { walletId: 'w-tng' }),
  ];

  it("lists this month's filed alerts the rule would have added: same app when the alert kept it, else same wallet", () => {
    expect(similarMatches(capture(), {}, history, '2026-10', KL).map((t) => t.id)).toEqual(['t-13', 't-07', 't-same-app']);
  });

  it('reads the month in the zone it is given', () => {
    const lateSeptember = [row('t-edge', '2026-09-30T17:00:00.000Z')];
    expect(similarMatches(capture(), {}, lateSeptember, '2026-10', KL).map((t) => t.id)).toEqual(['t-edge']);
    expect(similarMatches(capture(), {}, lateSeptember, '2026-10', UTC)).toEqual([]);
  });

  it('has nothing to preview for a capture that cannot make a rule', () => {
    expect(similarMatches(capture({ sourceType: 'text' }), {}, history, '2026-10', KL)).toEqual([]);
    expect(similarMatches(capture(), { type: 'income' }, history, '2026-10', KL)).toEqual([]);
  });
});

describe('merchantHistory', () => {
  it("lists this month's filed rows at the capture's merchant in its currency, newest first", () => {
    const rows = [
      row('t-1', '2026-10-03T04:30:00.000Z', { merchant: 'Grab*Food', metadata: {} }),
      row('t-2', '2026-10-09T04:30:00.000Z'),
      row('t-usd', '2026-10-10T04:30:00.000Z', { currency: 'USD' }),
      row('t-unfiled', '2026-10-11T04:30:00.000Z', { categoryId: null }),
    ];
    expect(merchantHistory(capture(), rows, '2026-10', KL).map((t) => t.id)).toEqual(['t-2', 't-1']);
  });
});

describe('inboxOrder', () => {
  it('puts the capture that happened first at the top', () => {
    const order = inboxOrder([
      capture({ id: 'parking', transactionDate: '2026-10-14T05:30:00.000Z' }),
      capture({ id: 'grab', transactionDate: '2026-10-14T04:41:00.000Z' }),
      capture({ id: 'no-date', transactionDate: null, createdAt: '2026-10-14T04:50:00.000Z' }),
    ]);
    expect(order.map((proposal) => proposal.id)).toEqual(['grab', 'no-date', 'parking']);
  });
});

describe('approvedRow', () => {
  const lookups = {
    categoriesById: { 'c-food': { name: 'Food & Dining', icon: 'silverware-fork-knife', color: '#FF7F70' } },
    walletNames: { 'w-tng': "Touch 'n Go" },
    aliases: [{ rawKey: 'grab food', displayName: 'GrabFood' }],
  };
  const approved = capture({ status: 'approved', reviewedAt: '2026-10-14T05:00:00.000Z', categoryId: null, transactionId: 't-1' }) as ReviewedProposal;
  const ledger = { 't-1': row('t-1', '2026-10-14T04:41:00.000Z', { walletId: 'w-tng', amountMinor: 2340 as MinorAmount, description: null, transferToWalletId: null, autoAdded: true, balanceCorrection: false }) };

  it('shows the category set on the ledger row when the capture had none', () => {
    expect(approvedRow(approved, ledger, lookups)).toMatchObject({
      title: 'GrabFood',
      category: 'Food & Dining',
      icon: 'silverware-fork-knife',
      color: '#FF7F70',
      wallet: "Touch 'n Go",
    });
  });

  it('is null for Not mine and for a ledger row since deleted', () => {
    expect(approvedRow({ ...approved, status: 'rejected' }, ledger, lookups)).toBeNull();
    expect(approvedRow(approved, {}, lookups)).toBeNull();
  });
});
