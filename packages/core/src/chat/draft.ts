import type { MerchantAlias } from '@repo/types';

import { monthOf, type DayKey, type MonthKey } from '../calendar';
import { countsAsSpending, type LedgerTransaction } from '../ledger';
import { merchantName } from '../read-model/merchants';

/**
 * A change of category for many rows, drafted from what the user typed in Moni chat without the
 * model: the gateway answers in text only, so the rows, the categories and the totals all come from
 * the ledger, and nothing here is sent anywhere.
 */
export type DraftRow = LedgerTransaction & {
  id: string;
  /** As stored; merchant names apply on top. */
  merchant: string | null;
  categoryId: string | null;
  /** Minor units, positive. */
  amountMinor: number;
  day: DayKey;
};

export type DraftCategory = { id: string; name: string };

export type CategoryDraft = {
  /** Null when the rows sit in more than one category. */
  from: DraftCategory | null;
  to: DraftCategory;
  /** Null when the message named `to`; otherwise the merchant's payments already there, which picked it. */
  alreadyThere: { count: number; names: string } | null;
  /** The rows to change, newest first, with merchant names applied. */
  rows: (DraftRow & { name: string })[];
  totalMinor: number;
};

export type DraftInput = {
  text: string;
  /** The rows the user is looking at: the ones a draft may change. */
  rows: readonly DraftRow[];
  /** Every row, for where a merchant's other payments sit. */
  history: readonly DraftRow[];
  categories: readonly DraftCategory[];
  aliases: readonly Pick<MerchantAlias, 'rawKey' | 'displayName'>[];
};

const VERB = String.raw`(?:move|put|change|switch|file|recategori[sz]e|mark|set)`;
const LEAD = String.raw`^(?:(?:please|pls|can you|could you)\s+)*${VERB}\s+(?:all\s+(?:of\s+)?)?(?:(?:my|the|these|those)\b\s*)?`;
const OUT_OF = new RegExp(`${LEAD}(.*?)\\s*\\b(?:out of|from)\\s+(.+?)(?:\\s+(?:to|into|in|as|under)\\s+(.+))?$`);
const INTO = new RegExp(`${LEAD}(.*?)\\s*\\b(?:to|into|in|as|under)\\s+(.+)$`);

/** Words that name rows without naming a merchant: "my Grab rides", "these rows". */
const GENERIC = new Set(
  'rides ride orders order payments payment transactions transaction rows row spends spend spending trips trip purchases purchase ones one charges charge expenses expense bills bill meals meal deliveries delivery items item entries entry them it stuff everything all these those this that'.split(
    ' ',
  ),
);

function words(text: string): string[] {
  return text.toLowerCase().replace(/&/g, ' and ').match(/[a-z0-9]+/g) ?? [];
}

/** The merchant words of "my Grab rides", or an empty list for "these rows". */
function merchantWords(phrase: string): string[] {
  return words(phrase.replace(/'s\b/gi, '')).filter((word) => !GENERIC.has(word));
}

function nameWords(name: string): string[] {
  return words(name).filter((word) => word !== 'and');
}

/** How well `phrase` names `name`: the whole name, every word, the first word, or a start of it. */
function nameScore(phrase: string, name: string): number {
  const asked = words(phrase.replace(/\bcategory\b/gi, '')).filter((word) => !['the', 'my', 'a'].includes(word));
  const parts = nameWords(name);
  if (!asked.length || !parts.length) return 0;
  if (asked.join(' ') === parts.join(' ')) return 4;
  if (parts.every((part) => asked.includes(part))) return 3;
  if (asked.length === 1 && asked[0] === parts[0]) return 2;
  // "transport" names Transportation; four letters keeps "car" off "Card fees".
  if (asked.length === 1 && asked[0]!.length >= 4 && (parts[0]!.startsWith(asked[0]!) || asked[0]!.startsWith(parts[0]!))) return 1;
  return 0;
}

function findCategory(phrase: string, categories: readonly DraftCategory[]): DraftCategory | null {
  let found: DraftCategory | null = null;
  let score = 0;
  for (const category of categories) {
    const next = nameScore(phrase, category.name);
    if (next > score) [found, score] = [category, next];
  }
  return found;
}

/** Each typed word starts a word of the merchant's name, as stored or as the user named it. */
function namesMerchant(typed: readonly string[], row: DraftRow, name: string): boolean {
  const tokens = [...words(row.merchant ?? ''), ...words(name)];
  return typed.every((word) => tokens.some((token) => token.startsWith(word)));
}

/** The category most of `rows` sit in, the newest breaking a tie. */
function mostCommon(rows: readonly DraftRow[]): { categoryId: string; count: number } | null {
  const tally = new Map<string, { count: number; newest: DayKey }>();
  for (const row of rows) {
    if (!row.categoryId) continue;
    const seen = tally.get(row.categoryId) ?? { count: 0, newest: row.day };
    tally.set(row.categoryId, { count: seen.count + 1, newest: row.day > seen.newest ? row.day : seen.newest });
  }
  let best: { categoryId: string; count: number; newest: DayKey } | null = null;
  for (const [categoryId, { count, newest }] of tally)
    if (!best || count > best.count || (count === best.count && newest > best.newest)) best = { categoryId, count, newest };
  return best && { categoryId: best.categoryId, count: best.count };
}

/**
 * Reads "Move my Grab rides out of Food", "put Starbucks in Food & Dining" or "change these to
 * Transport" against the rows in view, or answers null when the message is not such a request or
 * finds nothing to change. Only spending moves: transfers, balance fixes and debt cash have no
 * budget category. With only "out of" named, the target is where that merchant's other payments sit.
 */
export function draftCategoryChange({ text, rows, history, categories, aliases }: DraftInput): CategoryDraft | null {
  const message = text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
  const outOf = OUT_OF.exec(message);
  const into = outOf ? null : INTO.exec(message);
  if (!outOf && !into) return null;
  const typed = merchantWords((outOf ?? into)![1]!);
  const fromPhrase = outOf?.[2];
  const toPhrase = outOf ? outOf[3] : into![2];

  const from = fromPhrase ? findCategory(fromPhrase, categories) : null;
  if (fromPhrase && !from) return null;
  const asked = toPhrase ? findCategory(toPhrase, categories) : null;
  if (toPhrase && !asked) return null;

  const named = (row: DraftRow) => namesMerchant(typed, row, merchantName(row.merchant, aliases) ?? '');
  const candidates = rows.filter((row) => countsAsSpending(row) && named(row) && (!from || row.categoryId === from.id));
  if (!candidates.length) return null;

  let to = asked;
  let alreadyThere: CategoryDraft['alreadyThere'] = null;
  if (!to) {
    if (!typed.length) return null;
    const others = history.filter((row) => countsAsSpending(row) && row.categoryId !== from?.id && named(row));
    const usual = mostCommon(others);
    to = usual ? (categories.find((category) => category.id === usual.categoryId) ?? null) : null;
    if (usual) {
      const there = others.filter((row) => row.categoryId === usual.categoryId);
      alreadyThere = { count: there.length, names: listNames(there.map((row) => merchantName(row.merchant, aliases) ?? 'No merchant')) };
    }
  }
  if (!to || to.id === from?.id) return null;

  const moving = candidates
    .filter((row) => row.categoryId !== to.id)
    .map((row) => ({ ...row, name: merchantName(row.merchant, aliases) ?? 'No merchant' }))
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  if (!moving.length) return null;
  const sources = new Set(moving.map((row) => row.categoryId));
  const only = sources.size === 1 ? [...sources][0] : undefined;
  return {
    from: from ?? (only ? (categories.find((category) => category.id === only) ?? null) : null),
    to,
    alreadyThere,
    rows: moving,
    totalMinor: moving.reduce((sum, row) => sum + row.amountMinor, 0),
  };
}

function listNames(all: readonly string[]): string {
  const distinct = [...new Set(all)];
  if (distinct.length === 1) return distinct[0]!;
  if (distinct.length === 2) return `${distinct[0]} and ${distinct[1]}`;
  return `${distinct[0]} and ${distinct.length - 1} more`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Moni's line above the draft card, from the ledger like the card itself. */
export function draftIntro(draft: CategoryDraft): string {
  const n = draft.rows.length;
  const found = `${n} ${listNames(draft.rows.map((row) => row.name))} ${plural(n, 'row', 'rows')}${draft.from ? ` in ${draft.from.name}` : ''}`;
  const there = draft.alreadyThere;
  if (there)
    return `Your ${there.count} ${there.names} ${plural(there.count, 'payment is', 'payments are')} already in ${draft.to.name}. I found ${found}. If ${plural(n, 'it belongs', 'they belong')} there too:`;
  return `I found ${found}. To move ${plural(n, 'it', 'them')} to ${draft.to.name}:`;
}

export type CategoryAfter = { name: string; afterMinor: number; budgetMinor: number | null };

/**
 * Each category's month once the draft is approved: only rows in `month` move its spending.
 */
export function draftAfter(
  draft: CategoryDraft,
  month: MonthKey,
  current: (categoryId: string) => { spentMinor: number; budgetMinor: number | null },
): { from: CategoryAfter | null; to: CategoryAfter } {
  const moved = draft.rows.filter((row) => monthOf(row.day) === month);
  const total = (rows: readonly DraftRow[]) => rows.reduce((sum, row) => sum + row.amountMinor, 0);
  const at = (category: DraftCategory, change: number): CategoryAfter => {
    const { spentMinor, budgetMinor } = current(category.id);
    return { name: category.name, afterMinor: spentMinor + change, budgetMinor };
  };
  return {
    from: draft.from ? at(draft.from, -total(moved.filter((row) => row.categoryId === draft.from!.id))) : null,
    to: at(draft.to, total(moved)),
  };
}
