import { createCategorySchema, decimalToMinor, legacyColor, minorToDecimal, type MerchantAlias } from '@repo/types';

import { merchantKey } from '@/lib/ai/routine';
import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { merchantName } from '@/lib/finance/merchant-name';

import type { ImportRow } from './generic-csv';
import type { BackupTables, RawRow, TableName } from './moni-export';
import { TABLE_ORDER } from './moni-export';
import type { MoniFile, RowProblem } from './read-moni-export';

export type TableCount = { fresh: number; here: number };

/**
 * What a restore would do. Identity is the row's id: a row whose id the store already knows, live
 * or soft-deleted on this phone, is never written, so the store's copy always wins and a second run
 * finds nothing to write. Two tables also have a natural key the database enforces: a budget is
 * its category and currency, and a custom category is its type and name.
 */
export type RestorePlan = {
  kind: 'restore';
  counts: Record<TableName, TableCount>;
  problems: RowProblem[];
  writes: BackupTables;
  /** Debts the store already has that gain activity, whose status must be worked out again. */
  debtsToRefresh: string[];
};

/**
 * What a generic import would do. Its rows have no id, so identity is the local day, direction,
 * amount, currency and merchant, counted: two identical coffees in the file against one in the
 * store are one here and one new.
 */
export type GenericPlan = {
  kind: 'generic';
  fresh: ImportRow[];
  here: ImportRow[];
  problems: RowProblem[];
  /** One store row per `fresh` row, with no id yet. */
  writes: RawRow[];
};

export type ImportPlan = RestorePlan | GenericPlan;

/** Rows the store holds, each table with its soft-deleted rows too. */
export type StoreSnapshot = BackupTables;

const emptyCounts = () =>
  Object.fromEntries(TABLE_ORDER.map((table) => [table, { fresh: 0, here: 0 }])) as Record<
    TableName,
    TableCount
  >;

const emptyTables = (): BackupTables => ({
  wallets: [],
  categories: [],
  budgets: [],
  debts: [],
  debtActivities: [],
  transactions: [],
});

const idsOf = (rows: readonly RawRow[]) => new Set(rows.map((row) => String(row.id)));

const nameKey = (type: unknown, name: unknown) =>
  `${String(type)}|${String(name ?? '').trim().toLocaleLowerCase()}`;

export function planRestore(file: MoniFile, store: StoreSnapshot, userId: string): RestorePlan {
  const counts = emptyCounts();
  const writes = emptyTables();
  const problems = [...file.problems];
  const known = Object.fromEntries(
    TABLE_ORDER.map((table) => [table, idsOf(store[table])]),
  ) as Record<TableName, Set<string>>;

  /** Each file row once; a second row with an id already seen in this file is a problem. */
  function uniqueRows(table: TableName) {
    const firstLine = new Map<string, number>();
    return file.rows[table].filter((row) => {
      const id = String(row.fields.id);
      const seen = firstLine.get(id);
      if (seen !== undefined) {
        problems.push({ line: row.line, reason: `Same id as line ${seen}` });
        return false;
      }
      firstLine.set(id, row.line);
      return true;
    });
  }
  const owned = ({ yours: _yours, source: _source, ...fields }: RawRow): RawRow => ({
    ...fields,
    user_id: userId,
    deleted: false,
  });
  const note = (line: number, reason: string) => problems.push({ line, reason });

  const walletIds = new Set(known.wallets);
  for (const { fields } of uniqueRows('wallets')) {
    const id = String(fields.id);
    if (known.wallets.has(id)) {
      counts.wallets.here += 1;
      continue;
    }
    walletIds.add(id);
    counts.wallets.fresh += 1;
    writes.wallets.push(owned({ ...fields, color: legacyColor(fields.color as string | undefined) }));
  }

  // A category in the file resolves to the id the store knows it by.
  const categoryIds = new Map<string, string>([...known.categories].map((id) => [id, id]));
  const storeSystemByName = new Map<string, string>();
  const liveByName = new Map<string, string>();
  for (const row of store.categories) {
    if (row.deleted) continue;
    const key = nameKey(row.type, row.name);
    if (!row.user_id) storeSystemByName.set(key, String(row.id));
    if (row.is_active !== false && row.is_active !== 0) liveByName.set(key, String(row.id));
  }
  for (const { line, fields } of uniqueRows('categories')) {
    const id = String(fields.id);
    const key = nameKey(fields.type, fields.name);
    if (fields.yours === 'no') {
      // A system category is never written: the catalogue may have been reseeded under new ids.
      if (!known.categories.has(id)) {
        const system = storeSystemByName.get(key);
        if (system) categoryIds.set(id, system);
      }
      continue;
    }
    if (known.categories.has(id)) {
      counts.categories.here += 1;
      continue;
    }
    const sameName = fields.is_active === false ? undefined : liveByName.get(key);
    if (sameName) {
      categoryIds.set(id, sameName);
      counts.categories.here += 1;
      continue;
    }
    const color = legacyColor(fields.color as string | undefined);
    const valid = createCategorySchema.safeParse({
      name: fields.name,
      icon: fields.icon,
      color,
      type: fields.type,
    });
    if (!valid.success) {
      note(line, 'This category has an icon or colour Moni does not offer');
      continue;
    }
    categoryIds.set(id, id);
    counts.categories.fresh += 1;
    writes.categories.push(owned({ ...fields, color }));
  }

  const budgetKey = (categoryId: unknown, currency: unknown) => `${String(categoryId)}|${String(currency)}`;
  const budgetKeys = new Set(store.budgets.map((row) => budgetKey(row.category_id, row.currency)));
  for (const { line, fields } of uniqueRows('budgets')) {
    const categoryId = categoryIds.get(String(fields.category_id));
    if (known.budgets.has(String(fields.id))) {
      counts.budgets.here += 1;
    } else if (!categoryId) {
      note(line, 'Its category is not in this file or in Moni');
    } else if (budgetKeys.has(budgetKey(categoryId, fields.currency))) {
      counts.budgets.here += 1;
    } else {
      budgetKeys.add(budgetKey(categoryId, fields.currency));
      counts.budgets.fresh += 1;
      writes.budgets.push({ ...owned(fields), category_id: categoryId, period: 'monthly' });
    }
  }

  const debtIds = new Set(known.debts);
  const freshDebts = new Set<string>();
  for (const { fields } of uniqueRows('debts')) {
    const id = String(fields.id);
    if (known.debts.has(id)) {
      counts.debts.here += 1;
      continue;
    }
    debtIds.add(id);
    freshDebts.add(id);
    counts.debts.fresh += 1;
    writes.debts.push(owned(fields));
  }

  const debtsToRefresh = new Set<string>();
  for (const { line, fields } of uniqueRows('debtActivities')) {
    const debtId = String(fields.debt_id);
    if (known.debtActivities.has(String(fields.id))) {
      counts.debtActivities.here += 1;
    } else if (!debtIds.has(debtId)) {
      note(line, 'Its debt is not in this file or in Moni');
    } else if (fields.wallet_id && !walletIds.has(String(fields.wallet_id))) {
      note(line, 'Its wallet is not in this file or in Moni');
    } else {
      counts.debtActivities.fresh += 1;
      writes.debtActivities.push(owned(fields));
      if (!freshDebts.has(debtId)) debtsToRefresh.add(debtId);
    }
  }

  for (const { line, fields } of uniqueRows('transactions')) {
    const id = String(fields.id);
    if (known.transactions.has(id)) {
      counts.transactions.here += 1;
      continue;
    }
    if (!walletIds.has(String(fields.wallet_id))) {
      note(line, 'Its wallet is not in this file or in Moni');
      continue;
    }
    if (fields.transfer_to_wallet_id && !walletIds.has(String(fields.transfer_to_wallet_id))) {
      note(line, 'Its wallet is not in this file or in Moni');
      continue;
    }
    const metadata = (fields.metadata ?? {}) as Record<string, unknown>;
    counts.transactions.fresh += 1;
    writes.transactions.push({
      ...owned(fields),
      category_id: fields.category_id
        ? (categoryIds.get(String(fields.category_id)) ?? null)
        : null,
      // Whatever a spreadsheet did to the file, these rows stay out of budgets and reports.
      analysis_excluded:
        fields.analysis_excluded === true ||
        Boolean(fields.debt_activity_id) ||
        metadata.kind === 'balance_correction',
      linked_transaction_id:
        fields.linked_transaction_id && known.transactions.has(String(fields.linked_transaction_id))
          ? fields.linked_transaction_id
          : null,
      metadata:
        typeof metadata.source === 'string' || typeof fields.source !== 'string'
          ? metadata
          : { ...metadata, source: fields.source },
    });
  }

  return { kind: 'restore', counts, problems, writes, debtsToRefresh: [...debtsToRefresh] };
}

export function restoreTotals(plan: RestorePlan): TableCount {
  return TABLE_ORDER.reduce(
    (total, table) => ({
      fresh: total.fresh + plan.counts[table].fresh,
      here: total.here + plan.counts[table].here,
    }),
    { fresh: 0, here: 0 },
  );
}

export type GenericTarget = {
  userId: string;
  wallet: { id: string; currency: string };
  aliases: readonly Pick<MerchantAlias, 'rawKey' | 'displayName'>[];
};

function merchantIdentity(
  raw: string | null,
  aliases: GenericTarget['aliases'],
): string {
  const named = merchantName(raw, aliases);
  return merchantKey(named) ?? (named ?? '').trim().toLowerCase();
}

function identity(
  day: string,
  type: string,
  amountMinor: number,
  currency: string,
  merchant: string,
): string {
  return [day, type, amountMinor, currency, merchant].join('|');
}

export function planGeneric(
  rows: readonly ImportRow[],
  rowProblems: readonly RowProblem[],
  store: StoreSnapshot,
  target: GenericTarget,
): GenericPlan {
  const problems = [...rowProblems];
  const walletCurrency = target.wallet.currency.toUpperCase();

  const held = new Map<string, number>();
  for (const row of store.transactions) {
    if (row.deleted || row.user_id !== target.userId) continue;
    const date = new Date(String(row.transaction_date));
    if (Number.isNaN(date.getTime())) continue;
    let minor: number;
    try {
      minor = decimalToMinor(String(row.amount ?? ''));
    } catch {
      continue;
    }
    const key = identity(
      toLocalDateInput(date),
      String(row.type),
      minor,
      String(row.currency ?? '').toUpperCase(),
      merchantIdentity((row.merchant ?? row.description ?? null) as string | null, target.aliases),
    );
    held.set(key, (held.get(key) ?? 0) + 1);
  }

  const categories = new Map<string, string>();
  for (const row of store.categories) {
    if (row.deleted || row.is_active === false || row.is_active === 0) continue;
    categories.set(nameKey(row.type, row.name), String(row.id));
  }

  const fresh: ImportRow[] = [];
  const here: ImportRow[] = [];
  const writes: RawRow[] = [];
  for (const row of rows) {
    if (row.currency && row.currency !== walletCurrency) {
      problems.push({ line: row.line, reason: `In ${row.currency}, and this wallet is in ${walletCurrency}` });
      continue;
    }
    const key = identity(
      row.day,
      row.type,
      row.amountMinor,
      walletCurrency,
      merchantIdentity(row.merchant, target.aliases),
    );
    const count = held.get(key) ?? 0;
    if (count > 0) {
      held.set(key, count - 1);
      here.push(row);
      continue;
    }
    fresh.push(row);
    writes.push({
      user_id: target.userId,
      wallet_id: target.wallet.id,
      amount: minorToDecimal(row.amountMinor),
      currency: walletCurrency,
      type: row.type,
      analysis_excluded: false,
      debt_activity_id: null,
      category_id: row.categoryName
        ? (categories.get(nameKey(row.type, row.categoryName)) ?? null)
        : null,
      transfer_to_wallet_id: null,
      linked_transaction_id: null,
      description: null,
      merchant: row.merchant,
      notes: row.note,
      transaction_date: row.at,
      location_latitude: null,
      location_longitude: null,
      location_name: null,
      receipt_image_url: null,
      metadata: { source: 'manual', imported: true },
      deleted: false,
    });
  }
  return { kind: 'generic', fresh, here, problems, writes };
}
