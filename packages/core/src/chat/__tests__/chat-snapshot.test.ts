import { describe, expect, it, vi } from 'vitest';

import { createCalendar } from '../../calendar';
import { buildChatSnapshot } from '../chat-snapshot';
import { MYR, SGD, budget, byId, category, proposal, spend, wallet } from './chat-rows';

const KL = createCalendar('Asia/Kuala_Lumpur');
const NOW = new Date('2026-10-14T14:00:00+08:00');

const projection = {
  transactionsById: byId([
    spend('me', [10, 10], 30, { categoryId: 'food' }),
    spend('me', [10, 12], 20, { categoryId: 'hobbies' }),
    spend('me', [10, 13], 7, { categoryId: 'theirs' }),
    spend('them', [10, 12], 999, { categoryId: 'food', walletId: 'theirs' }),
  ]),
  categoriesById: byId([
    category('food', 'Food', null),
    category('hobbies', 'Hobbies', 'me'),
    category('theirs', 'Their Hobbies', 'them'),
  ]),
  budgetsById: byId([budget('me', 'food', 300), budget('them', 'food', 50)]),
  walletsById: byId([
    wallet('maybank', 'me', MYR, 1000),
    wallet('dbs', 'me', SGD, 200),
    wallet('theirs', 'them', MYR, 5000),
  ]),
  proposalsById: byId([
    proposal('in-dbs', 'me', 8, { walletId: 'dbs' }),
    proposal('bank-alert', 'me', 12, { sourceType: 'notification', currency: MYR }),
    proposal('typed', 'me', 50, {}),
    proposal('untyped', 'me', 40, { type: null, walletId: 'maybank' }),
    proposal('their-capture', 'them', 100, { walletId: 'maybank' }),
  ]),
};

function snapshot() {
  return buildChatSnapshot({
    projection,
    userId: 'me',
    overrides: [],
    message: 'How am I doing?',
    now: NOW,
    calendar: KL,
  });
}

describe('buildChatSnapshot', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { schema, currencies } = snapshot();
  const warnings = warn.mock.calls.map(([message]) => message);
  warn.mockRestore();

  it("reads only the user's rows, one block per currency", () => {
    expect(schema).toBe('finance_assistant_tool_v4');
    expect(Object.keys(currencies)).toEqual(['MYR', 'SGD']);
    expect(currencies.MYR!.rolling30.current.expenseTotal).toBe(57);
  });

  it("names the user's and the preset categories, and no one else's", () => {
    expect(currencies.MYR!.rolling30.topCategories).toEqual([
      { name: 'Food', amount: 30 },
      { name: 'Hobbies', amount: 20 },
      { name: 'Uncategorized', amount: 7 },
    ]);
    expect(
      currencies.MYR!.budgetCoach.categories.map((c) => [
        c.categoryName,
        c.budgetAmount,
        c.spentTotal,
      ]),
    ).toEqual([['Food', 300, 30]]);
  });

  it("files a capture under its wallet's currency, a bank alert under its own, and drops a typed one", () => {
    expect(currencies.MYR!.pendingProposals).toEqual({
      count: 1,
      expenseTotal: 12,
      incomeTotal: 0,
    });
    expect(currencies.SGD!.pendingProposals).toEqual({ count: 1, expenseTotal: 8, incomeTotal: 0 });
    expect(warnings).toEqual(['[finance-metrics] skipped 1 pending proposals without currency']);
  });

  it("counts the user's wallets in each currency's facts", () => {
    expect(currencies.MYR!.facts?.balances).toEqual({
      liquid: 943,
      changeLast30Days: -57,
      walletCount: 1,
    });
    expect(currencies.SGD!.facts?.balances).toEqual({
      liquid: 200,
      changeLast30Days: 0,
      walletCount: 1,
    });
  });
});
