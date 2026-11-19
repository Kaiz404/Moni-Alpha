import type { AutoAddRule } from '@repo/types';

import type { StoredRow } from '../write-plans/types';
import { guessMerchantName } from './merchants';

/** A "Don't ask about similar" rule as Review lists it: what it is about and what it does. */
export type AutoAddRuleItem = { rule: AutoAddRule; name: string; line: string };

function ruleOf(row: StoredRow<'auto_add_rules'>): AutoAddRule {
  return {
    id: row.id,
    userId: row.user_id ?? '',
    merchantKey: row.merchant_key ?? '',
    sourceApp: row.source_app ?? '',
    walletId: row.wallet_id ?? '',
    categoryId: row.category_id ?? '',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? row.created_at ?? '',
    deleted: row.deleted === true,
  };
}

/** The user's live rules, one per app and merchant: devices offline can each write one, and the newest wins. */
export function liveAutoAddRules(rows: readonly StoredRow<'auto_add_rules'>[], userId: string): AutoAddRule[] {
  const latest = new Map<string, AutoAddRule>();
  for (const row of rows) {
    if (row.user_id !== userId || row.deleted) continue;
    if (!row.merchant_key || !row.source_app || !row.wallet_id || !row.category_id) continue;
    const rule = ruleOf(row);
    const key = `${rule.sourceApp}|${rule.merchantKey}`;
    const current = latest.get(key);
    if (!current || rule.updatedAt > current.updatedAt) latest.set(key, rule);
  }
  return [...latest.values()];
}

/** Each rule named as the user named the merchant, with what it does, in name order. */
export function autoAddRuleItems(
  rules: readonly AutoAddRule[],
  lookups: { aliases: ReadonlyMap<string, string>; categoryNames: Readonly<Record<string, string | undefined>> },
): AutoAddRuleItem[] {
  return rules
    .map((rule) => {
      const category = lookups.categoryNames[rule.categoryId];
      return {
        rule,
        name: lookups.aliases.get(rule.merchantKey) ?? guessMerchantName(rule.merchantKey) ?? rule.merchantKey.toUpperCase(),
        line: category ? `Adds to ${category} without asking` : 'Adds without asking',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
