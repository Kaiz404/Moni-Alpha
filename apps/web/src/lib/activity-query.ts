import { formatMoney, monthName, type ActivityKind } from '@repo/core';

/**
 * Activity's view of the ledger as the URL holds it (W2-Responsive: where you are lives in the URL), so
 * a reload, a shared link or a resize keeps the view, the filters, the sort and the page.
 */
export const SORT_KEYS = ['date', 'merchant', 'category', 'wallet', 'source', 'amount'] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export const SOURCE_KEYS = ['manual', 'voice', 'moni', 'notification', 'camera', 'auto'] as const;
export type SourceFilter = (typeof SOURCE_KEYS)[number];
export const BUILT_IN_VIEWS = ['all', 'check', 'auto'] as const;
export type BuiltInView = (typeof BUILT_IN_VIEWS)[number];

export const PAGE_SIZE = 25;

export type ActivityFilters = {
  /** Local days, both ends kept; null is "this month so far". */
  from: string | null;
  to: string | null;
  kind: ActivityKind;
  wallets: string[];
  categories: string[];
  sources: SourceFilter[];
  /** Whole or decimal ringgit, both ends kept. */
  min: number | null;
  max: number | null;
  /** Merchant, note, category or the start of an amount. */
  q: string;
};

export type ActivityQuery = ActivityFilters & {
  show: 'table' | 'list';
  /** A built-in view or the id of a saved one. */
  saved: string;
  sort: SortKey;
  dir: 'asc' | 'desc';
  page: number;
};

export const NO_FILTERS: ActivityFilters = {
  from: null,
  to: null,
  kind: 'all',
  wallets: [],
  categories: [],
  sources: [],
  min: null,
  max: null,
  q: '',
};

export const DEFAULT_QUERY: ActivityQuery = { ...NO_FILTERS, show: 'table', saved: 'all', sort: 'date', dir: 'desc', page: 1 };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const list = (value: string | null) => (value ? value.split(',').filter(Boolean) : []);
const number = (value: string | null) => {
  const parsed = value === null || value === '' ? NaN : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const oneOf = <T extends string>(choices: readonly T[], value: string | null, fallback: T): T =>
  choices.includes(value as T) ? (value as T) : fallback;

export function parseActivityQuery(params: URLSearchParams): ActivityQuery {
  const from = params.get('from');
  const to = params.get('to');
  return {
    show: params.get('show') === 'list' ? 'list' : 'table',
    saved: params.get('view') || 'all',
    sort: oneOf(SORT_KEYS, params.get('sort'), 'date'),
    dir: params.get('dir') === 'asc' ? 'asc' : 'desc',
    page: Math.max(1, Math.floor(number(params.get('page')) ?? 1)),
    from: from && DAY.test(from) ? from : null,
    to: to && DAY.test(to) ? to : null,
    kind: oneOf(['all', 'expense', 'income', 'transfer'] as const, params.get('type'), 'all'),
    wallets: list(params.get('wallets')),
    categories: list(params.get('categories')),
    sources: list(params.get('sources')).filter((source): source is SourceFilter => SOURCE_KEYS.includes(source as SourceFilter)),
    min: number(params.get('min')),
    max: number(params.get('max')),
    q: params.get('q') ?? '',
  };
}

/** The query as URL parameters, leaving out every default so a plain Activity link stays `/activity`. */
export function activityQueryString(query: ActivityQuery, keep?: URLSearchParams): string {
  const params = new URLSearchParams();
  const pane = keep?.get('pane');
  if (pane) params.set('pane', pane);
  const set = (key: string, value: string | null, fallback = '') => {
    if (value !== null && value !== fallback) params.set(key, value);
  };
  set('show', query.show, 'table');
  set('view', query.saved, 'all');
  set('sort', query.sort, 'date');
  set('dir', query.dir, 'desc');
  set('page', String(query.page), '1');
  set('from', query.from);
  set('to', query.to);
  set('type', query.kind, 'all');
  set('wallets', query.wallets.join(','));
  set('categories', query.categories.join(','));
  set('sources', query.sources.join(','));
  set('min', query.min === null ? null : String(query.min));
  set('max', query.max === null ? null : String(query.max));
  set('q', query.q);
  const text = params.toString();
  return text ? `?${text}` : '';
}

export function filtersOf(query: ActivityQuery): ActivityFilters {
  const { from, to, kind, wallets, categories, sources, min, max, q } = query;
  return { from, to, kind, wallets, categories, sources, min, max, q };
}

export function sameFilters(a: ActivityFilters, b: ActivityFilters): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** One Activity row with what filtering and sorting read; built from the read model by the screen. */
export type ActivityItem = {
  id: string;
  /** ISO time. */
  at: string;
  /** Local day. */
  day: string;
  title: string;
  kind: 'expense' | 'income' | 'transfer';
  categoryId: string | null;
  category: string | null;
  walletId: string;
  toWalletId: string | null;
  wallet: string;
  source: Exclude<SourceFilter, 'auto'>;
  auto: boolean;
  /** Minor units, positive. */
  amountMinor: number;
  hasPlace: boolean;
  notes: string | null;
};

/** What "To check" asks about: spending with no category, or with no place to show on the map. */
export function checkReason(item: Pick<ActivityItem, 'kind' | 'categoryId' | 'hasPlace'>): 'No category' | 'No place' | null {
  if (item.kind !== 'expense') return null;
  if (!item.categoryId) return 'No category';
  return item.hasPlace ? null : 'No place';
}

function matches(item: ActivityItem, filters: ActivityFilters, range: { from: string; to: string }): boolean {
  const from = filters.from ?? range.from;
  const to = filters.to ?? range.to;
  if (item.day < from || item.day > to) return false;
  if (filters.kind !== 'all' && item.kind !== filters.kind) return false;
  if (filters.wallets.length && !filters.wallets.includes(item.walletId) && !(item.toWalletId && filters.wallets.includes(item.toWalletId)))
    return false;
  if (filters.categories.length && !(item.categoryId && filters.categories.includes(item.categoryId))) return false;
  if (filters.sources.length && !filters.sources.some((source) => (source === 'auto' ? item.auto : item.source === source))) return false;
  const amount = item.amountMinor / 100;
  if (filters.min !== null && amount < filters.min) return false;
  if (filters.max !== null && amount > filters.max) return false;
  const words = filters.q
    .split(',')
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);
  if (words.length) {
    const text = [item.title, item.category, item.notes].filter(Boolean).join(' ').toLowerCase();
    const money = amount.toFixed(2);
    if (!words.some((word) => text.includes(word) || money.startsWith(word.replace(/^rm/, '').replaceAll(',', '')))) return false;
  }
  return true;
}

const SORT_VALUE: Record<SortKey, (item: ActivityItem) => string | number> = {
  date: (item) => item.at,
  merchant: (item) => item.title.toLowerCase(),
  category: (item) => (item.kind === 'transfer' ? '~' : (item.category ?? '~').toLowerCase()),
  wallet: (item) => item.wallet.toLowerCase(),
  source: (item) => item.source,
  amount: (item) => (item.kind === 'expense' ? -item.amountMinor : item.kind === 'income' ? item.amountMinor : 0),
};

/**
 * The rows a view shows, in its order: the built-in view's rule, then the filters, then the sort, ties
 * newest first. `range` is the default date span (this month so far).
 */
export function selectActivity(
  items: readonly ActivityItem[],
  query: ActivityQuery,
  range: { from: string; to: string },
): ActivityItem[] {
  const rule = query.saved === 'check' ? (item: ActivityItem) => checkReason(item) !== null : query.saved === 'auto' ? (item: ActivityItem) => item.auto : () => true;
  const value = SORT_VALUE[query.sort];
  const direction = query.dir === 'asc' ? 1 : -1;
  return items
    .filter((item) => rule(item) && matches(item, query, range))
    .sort((a, b) => {
      const left = value(a);
      const right = value(b);
      return (left < right ? -1 : left > right ? 1 : 0) * direction || b.at.localeCompare(a.at);
    });
}

export type ActivityPage<T> = { rows: T[]; page: number; pages: number; first: number; last: number; total: number };

/** Numbered pages of 25 (W2-Activity); a page past the end shows the last one. */
export function pageOf<T>(rows: readonly T[], page: number, size = PAGE_SIZE): ActivityPage<T> {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * size;
  const shown = rows.slice(start, start + size);
  return { rows: shown, page: current, pages, first: shown.length ? start + 1 : 0, last: start + shown.length, total: rows.length };
}

/** A sort header's click: the same column flips, another starts descending. */
export function nextSort(query: Pick<ActivityQuery, 'sort' | 'dir'>, key: SortKey): Pick<ActivityQuery, 'sort' | 'dir'> {
  return { sort: key, dir: query.sort === key && query.dir === 'desc' ? 'asc' : 'desc' };
}

export type SavedView = { id: string; name: string; filters: ActivityFilters };

export function parseSavedViews(raw: string | null): SavedView[] {
  try {
    const value = JSON.parse(raw ?? '[]') as unknown;
    if (!Array.isArray(value)) return [];
    return value.flatMap((view): SavedView[] => {
      if (!view || typeof view.id !== 'string' || typeof view.name !== 'string' || typeof view.filters !== 'object') return [];
      const params = new URLSearchParams(activityQueryString({ ...DEFAULT_QUERY, ...view.filters }).slice(1));
      return [{ id: view.id, name: view.name.slice(0, 40), filters: filtersOf(parseActivityQuery(params)) }];
    });
  } catch {
    return [];
  }
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "1 to 14 Oct", or "28 Sep to 14 Oct" across a month, from two local days. */
function dayRange(from: string, to: string): string {
  const [, fromMonth, fromDay] = from.split('-').map(Number);
  const [, toMonth, toDay] = to.split('-').map(Number);
  const month = (m: number | undefined) => SHORT_MONTHS[(m ?? 1) - 1];
  return fromMonth === toMonth ? `${fromDay} to ${toDay} ${month(toMonth)}` : `${fromDay} ${month(fromMonth)} to ${toDay} ${month(toMonth)}`;
}

/**
 * W2-Empty's line for filters that match nothing, naming them in plain words so it is clear why:
 * "No Gifts paid with Touch 'n Go from 1 to 14 Oct."
 */
export function noMatchLine(
  filters: ActivityFilters,
  range: { from: string; to: string },
  names: { categories: Record<string, string>; wallets: Record<string, string> },
): string {
  const or = (ids: readonly string[], byId: Record<string, string>) => ids.map((id) => byId[id] ?? 'one').join(' or ');
  const what = filters.categories.length ? or(filters.categories, names.categories) : filters.kind === 'income' ? 'income' : filters.kind === 'transfer' ? 'transfers' : filters.kind === 'expense' ? 'spending' : 'transactions';
  const paid = filters.wallets.length ? ` paid with ${or(filters.wallets, names.wallets)}` : '';
  const matching = filters.q.trim() ? ` matching “${filters.q.trim()}”` : '';
  return `No ${what}${paid}${matching} from ${dayRange(filters.from ?? range.from, filters.to ?? range.to)}.`;
}

/**
 * W2-Parts' delete confirm: what goes, and what it does to the month, with Undo in the toast after.
 * Only spending moves the month's total, so the line names it when there is some.
 */
export function deleteWords(
  items: readonly Pick<ActivityItem, 'kind' | 'amountMinor' | 'day'>[],
  currency: string,
): { title: string; line: string; action: string } {
  const spent = items.filter((item) => item.kind === 'expense');
  const total = formatMoney(spent.reduce((sum, item) => sum + item.amountMinor, 0), currency);
  const months = [...new Set(spent.map((item) => item.day.slice(0, 7)))];
  const whose = months.length === 1 ? `${monthName(months[0]!)}'s spending` : 'your spending';
  if (items.length === 1) {
    return {
      title: 'Delete this transaction?',
      line: spent.length ? `${whose.charAt(0).toUpperCase()}${whose.slice(1)} goes down by ${total}. You can undo it from the toast.` : 'You can undo it from the toast.',
      action: 'Delete',
    };
  }
  return {
    title: `Delete ${items.length} transactions?`,
    line: spent.length ? `${total} comes off ${whose}. Undo puts all ${items.length} back.` : `Undo puts all ${items.length} back.`,
    action: `Delete ${items.length}`,
  };
}
