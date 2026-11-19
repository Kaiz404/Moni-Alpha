import { describe, expect, it } from 'vitest';

import type { StoredRow } from '../../write-plans/types';
import { autoAddRuleItems, liveAutoAddRules } from '../auto-add-rules';

const USER = '00000000-0000-4000-8000-000000000001';

const row = (id: string, merchant: string, updated: string, extra: Partial<StoredRow<'auto_add_rules'>> = {}): StoredRow<'auto_add_rules'> => ({
  id,
  user_id: USER,
  merchant_key: merchant,
  source_app: 'com.maybank2u.life',
  wallet_id: 'wallet-1',
  category_id: 'cat-subs',
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: updated,
  deleted: false,
  ...extra,
});

describe('liveAutoAddRules', () => {
  it('keeps the newest rule per app and merchant, and drops deleted, other users and half-written rows', () => {
    const rules = liveAutoAddRules(
      [
        row('old', 'spotify', '2026-10-01T00:00:00.000Z'),
        row('new', 'spotify', '2026-10-05T00:00:00.000Z', { category_id: 'cat-fun' }),
        row('gone', 'grab', '2026-10-02T00:00:00.000Z', { deleted: true }),
        row('theirs', 'tesco', '2026-10-02T00:00:00.000Z', { user_id: 'someone-else' }),
        row('half', 'shell', '2026-10-02T00:00:00.000Z', { category_id: undefined }),
      ],
      USER,
    );
    expect(rules.map((rule) => [rule.id, rule.categoryId])).toEqual([['new', 'cat-fun']]);
  });
});

describe('autoAddRuleItems', () => {
  it('names each rule as the user named the merchant and says what it does, in name order', () => {
    const rules = liveAutoAddRules(
      [
        row('a', 'spotify', '2026-10-01T00:00:00.000Z'),
        row('b', 'grab', '2026-10-01T00:00:00.000Z', { category_id: 'cat-gone' }),
        row('c', 'kk super mart', '2026-10-01T00:00:00.000Z'),
      ],
      USER,
    );
    const items = autoAddRuleItems(rules, {
      aliases: new Map([['kk super mart', 'KK Mart']]),
      categoryNames: { 'cat-subs': 'Subscriptions' },
    });
    expect(items.map((item) => [item.name, item.line])).toEqual([
      ['Grab', 'Adds without asking'],
      ['KK Mart', 'Adds to Subscriptions without asking'],
      ['Spotify', 'Adds to Subscriptions without asking'],
    ]);
  });
});
