/**
 * Liquid balance and a cash forecast to the next payday (or month end) for one currency.
 * The chat model only narrates this; it is shown only when the inputs can carry it.
 */
import { minorToNumber, type MinorAmount, type RecurringOverride } from '@repo/types';
import { transactionDeltaMinor } from '@/lib/finance/ledger';
import type { FinanceWallet } from '@/lib/finance/types';
import { dayKey, dayNumber, dayStart, nextMonthStart } from './days';
import {
  CONFIDENT,
  detectRecurring,
  isCashFlow,
  pickPayday,
  seriesDates,
  seriesKey,
  type FactsTransaction,
  type RecurringSeries,
} from './recurring';

export type FactsWallet = Pick<
  FinanceWallet,
  'id' | 'type' | 'currency' | 'initialBalanceMinor' | 'isActive' | 'balanceConfirmedAt'
>;

const LIQUID_TYPES = new Set(['bank', 'cash', 'debit', 'ewallet']);
export const MIN_HISTORY_DAYS = 45;
export const MAX_BALANCE_AGE_DAYS = 30;
export const MIN_COVERAGE_PCT = 70;
/** A range wider than this share of the starting balance is too vague to be worth showing. */
export const MAX_BAND_SHARE = 0.4;
/** Without a payday, income outside trusted series above this share of spending makes the range a guess. */
export const MAX_IRREGULAR_INCOME_SHARE = 0.2;
const LOOKBACK_DAYS = 56;
/** Spend is sampled in windows this long, or as long as the horizon when that is shorter. */
const WINDOW_DAYS = 7;
/**
 * Percentiles of windowed spend for the light, typical and heavy cases. P25/P75 covered only
 * half of the backtest outcomes (an interquartile range holds half by construction); P10/P90
 * covers about 80%.
 */
const SPEND_PERCENTILES = { low: 0.1, likely: 0.5, high: 0.9 };

export type ForecastBasis = {
  historyDays: number;
  /** Logged spending as a share of logged spending plus balance corrections that lowered a balance. */
  coveragePct: number;
  /** Age of the stalest confirmed balance among liquid wallets in use. */
  balanceConfirmedDaysAgo: number | null;
};

export type ForecastLine = { name: string; amount: number; date: string };
export type Band = { low: number; likely: number; high: number };

export type Afford = {
  amount: number;
  worstCaseAfter: number;
  likelyAfter: number;
  /** True when the worst case still ends at or above zero after this spend. */
  fitsWorstCase: boolean;
};

export type Forecast =
  | ({
      status: 'ready';
      horizon: 'payday' | 'month_end';
      horizonDate: string;
      daysLeft: number;
      startBalance: number;
      bills: ForecastLine[];
      billsTotal: number;
      income: ForecastLine[];
      incomeTotal: number;
      /** Day-to-day spending until the horizon; `high` is the heavy-spending case. */
      variableSpend: Band;
      /** Balance just before the horizon; `low` is the worst case. */
      endBalance: Band;
      afford?: Afford;
    } & ForecastBasis)
  | ({ status: 'insufficient'; reasons: string[] } & ForecastBasis);

export function liquidWallets(wallets: readonly FactsWallet[], currency: string): FactsWallet[] {
  return wallets.filter((w) => w.isActive && w.currency === currency && LIQUID_TYPES.has(w.type));
}

/** Sum of the wallets' balances counting transactions dated up to `asOf`. */
export function balanceMinor(
  wallets: readonly FactsWallet[],
  transactions: readonly FactsTransaction[],
  asOf: Date,
): number {
  const ids = new Set(wallets.map((w) => w.id));
  let total = wallets.reduce((sum, w) => sum + Number(w.initialBalanceMinor), 0);
  for (const tx of transactions) {
    if (new Date(tx.transactionDate) > asOf) continue;
    for (const id of new Set([tx.walletId, tx.transferToWalletId])) {
      if (id && ids.has(id)) total += Number(transactionDeltaMinor(tx, id));
    }
  }
  return total;
}

function quantile(sorted: number[], q: number): number {
  const at = (sorted.length - 1) * q;
  const lower = Math.floor(at);
  const upper = Math.ceil(at);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (at - lower);
}

/** Liquid wallets holding money or used in the lookback; a dormant empty one needs no confirming. */
function inUseWallets(
  liquid: FactsWallet[],
  transactions: FactsTransaction[],
  now: Date,
): FactsWallet[] {
  const from = dayNumber(now) - LOOKBACK_DAYS;
  const active = new Set(
    transactions
      .filter((tx) => dayNumber(tx.transactionDate) >= from)
      .flatMap((tx) => [tx.walletId, tx.transferToWalletId]),
  );
  return liquid.filter((w) => active.has(w.id) || balanceMinor([w], transactions, now) !== 0);
}

function basisFor(
  liquid: FactsWallet[],
  inUse: FactsWallet[],
  transactions: FactsTransaction[],
  today: number,
): ForecastBasis {
  const flowDays = transactions.filter(isCashFlow).map((tx) => dayNumber(tx.transactionDate));
  const historyDays = flowDays.length ? today - Math.min(...flowDays) : 0;

  const ids = new Set(liquid.map((w) => w.id));
  const from = today - LOOKBACK_DAYS;
  let logged = 0;
  let corrected = 0;
  for (const tx of transactions) {
    const day = dayNumber(tx.transactionDate);
    if (tx.type !== 'expense' || day < from || day > today || tx.debtActivityId) continue;
    if (!tx.analysisExcluded) logged += Number(tx.amountMinor);
    else if (ids.has(tx.walletId)) corrected += Number(tx.amountMinor);
  }
  const coveragePct =
    logged + corrected === 0 ? 100 : Math.round((logged / (logged + corrected)) * 100);

  const ages = inUse.map((w) =>
    w.balanceConfirmedAt ? today - dayNumber(w.balanceConfirmedAt) : null,
  );
  const balanceConfirmedDaysAgo =
    ages.length && ages.every((age) => age !== null) ? Math.max(...(ages as number[])) : null;

  return { historyDays, coveragePct, balanceConfirmedDaysAgo };
}

/** Income outside `trustedKeys` over the lookback, as a share of spending over it. */
function irregularIncomeShare(
  transactions: FactsTransaction[],
  trustedKeys: Set<string>,
  today: number,
): number {
  let irregular = 0;
  let spent = 0;
  for (const tx of transactions) {
    const day = dayNumber(tx.transactionDate);
    if (!isCashFlow(tx) || day < today - LOOKBACK_DAYS || day > today) continue;
    if (tx.type === 'expense') spent += Number(tx.amountMinor);
    else if (tx.type === 'income' && !trustedKeys.has(seriesKey(tx) ?? '')) {
      irregular += Number(tx.amountMinor);
    }
  }
  return spent ? irregular / spent : irregular > 0 ? 1 : 0;
}

/** Spend outside recurring series in every `windowDays` window of the lookback, at each percentile. */
function variableWindowMinor(
  transactions: FactsTransaction[],
  recurringKeys: Set<string>,
  today: number,
  lookback: number,
  windowDays: number,
): Record<keyof typeof SPEND_PERCENTILES, number> {
  const daily = new Array<number>(lookback).fill(0);
  for (const tx of transactions) {
    if (tx.type !== 'expense' || !isCashFlow(tx)) continue;
    const key = seriesKey(tx);
    if (key && recurringKeys.has(key)) continue;
    const index = dayNumber(tx.transactionDate) - (today - lookback);
    if (index >= 0 && index < lookback) daily[index] += Number(tx.amountMinor);
  }
  const sums: number[] = [];
  for (let start = 0; start + windowDays <= lookback; start += 1) {
    sums.push(daily.slice(start, start + windowDays).reduce((a, b) => a + b, 0));
  }
  sums.sort((a, b) => a - b);
  return {
    low: quantile(sums, SPEND_PERCENTILES.low),
    likely: quantile(sums, SPEND_PERCENTILES.likely),
    high: quantile(sums, SPEND_PERCENTILES.high),
  };
}

/**
 * Liquid balance − bills due before the horizon + trusted income before it − day-to-day spend.
 * Bills count even when unconfirmed and income only when trusted, so doubt lowers the forecast.
 */
export function forecastCurrency(input: {
  currency: string;
  wallets: readonly FactsWallet[];
  transactions: readonly FactsTransaction[];
  series: readonly RecurringSeries[];
  payday: RecurringSeries | null;
  now: Date;
  extraSpendMinor?: MinorAmount | null;
}): Forecast {
  const { currency, now } = input;
  const today = dayNumber(now);
  const transactions = input.transactions.filter(
    (tx) => tx.currency === currency && new Date(tx.transactionDate) <= now,
  );
  const liquid = liquidWallets(input.wallets, currency);
  const inUse = inUseWallets(liquid, transactions, now);
  const basis = basisFor(liquid, inUse, transactions, today);
  const startMinor = balanceMinor(liquid, transactions, now);

  const reasons: string[] = [];
  if (!liquid.length) reasons.push('no cash, bank or e-wallet account in this currency');
  if (basis.historyDays < MIN_HISTORY_DAYS) reasons.push('not enough history yet');
  if (inUse.length && (basis.balanceConfirmedDaysAgo ?? Infinity) > MAX_BALANCE_AGE_DAYS)
    reasons.push('wallet balances not confirmed recently');
  if (basis.coveragePct < MIN_COVERAGE_PCT) reasons.push('too much spending not logged');
  if (liquid.length && startMinor <= 0) reasons.push('no money in cash, bank or e-wallet accounts');
  if (reasons.length) return { status: 'insufficient', reasons, ...basis };

  const series = input.series.filter((s) => s.currency === currency);
  const trustedIncome = series.filter(
    (s) => s.type === 'income' && (s.confirmed || s.confidence >= CONFIDENT),
  );
  if (
    !input.payday &&
    irregularIncomeShare(transactions, new Set(trustedIncome.map((s) => s.key)), today) >
      MAX_IRREGULAR_INCOME_SHARE
  ) {
    return {
      status: 'insufficient',
      reasons: ['income arrives without a regular payday'],
      ...basis,
    };
  }

  const payday = input.payday && input.payday.nextExpectedDay > today ? input.payday : null;
  const endDay = payday ? payday.nextExpectedDay : nextMonthStart(today);
  const daysLeft = endDay - today;

  const lines = (list: RecurringSeries[], from: number) =>
    list
      .flatMap((s) =>
        seriesDates(s, endDay)
          .filter((day) => day >= from)
          .map((day) => ({
            name: s.label,
            minor: Number(s.expectedAmountMinor),
            day: Math.max(day, today),
          })),
      )
      .sort((a, b) => a.day - b.day);
  const bills = lines(
    series.filter((s) => s.type === 'expense'),
    -Infinity,
  );
  const income = lines(trustedIncome, today + 1);
  const billsMinor = bills.reduce((sum, b) => sum + b.minor, 0);
  const incomeMinor = income.reduce((sum, i) => sum + i.minor, 0);

  const windowDays = Math.min(daysLeft, WINDOW_DAYS);
  const window = variableWindowMinor(
    transactions,
    new Set(series.filter((s) => s.type === 'expense').map((s) => s.key)),
    today,
    Math.min(LOOKBACK_DAYS, basis.historyDays),
    windowDays,
  );
  const scale = daysLeft / windowDays;
  const spend = {
    low: Math.round(window.low * scale),
    likely: Math.round(window.likely * scale),
    high: Math.round(window.high * scale),
  };
  const fixedEnd = startMinor - billsMinor + incomeMinor;
  const end = {
    low: fixedEnd - spend.high,
    likely: fixedEnd - spend.likely,
    high: fixedEnd - spend.low,
  };

  if (end.high - end.low > startMinor * MAX_BAND_SHARE) {
    return {
      status: 'insufficient',
      reasons: ['spending too uneven for a useful range'],
      ...basis,
    };
  }

  const toLine = (l: { name: string; minor: number; day: number }) => ({
    name: l.name,
    amount: minorToNumber(l.minor),
    date: dayKey(l.day),
  });
  const band = (b: { low: number; likely: number; high: number }): Band => ({
    low: minorToNumber(b.low),
    likely: minorToNumber(b.likely),
    high: minorToNumber(b.high),
  });
  const extra = input.extraSpendMinor ? Number(input.extraSpendMinor) : null;

  return {
    status: 'ready',
    horizon: payday ? 'payday' : 'month_end',
    horizonDate: dayKey(payday ? endDay : endDay - 1),
    daysLeft,
    startBalance: minorToNumber(startMinor),
    bills: bills.map(toLine),
    billsTotal: minorToNumber(billsMinor),
    income: income.map(toLine),
    incomeTotal: minorToNumber(incomeMinor),
    variableSpend: band(spend),
    endBalance: band(end),
    ...(extra
      ? {
          afford: {
            amount: minorToNumber(extra),
            worstCaseAfter: minorToNumber(end.low - extra),
            likelyAfter: minorToNumber(end.likely - extra),
            fitsWorstCase: end.low - extra >= 0,
          },
        }
      : {}),
    ...basis,
  };
}

export type BacktestResult = { evaluated: number; inside: number; share: number };

/**
 * Replays the ledger as of each day in `days` (balances treated as confirmed that day) and
 * counts how often the real balance just before the horizon, or before an early salary,
 * landed inside [low, high].
 */
export function backtestForecast(input: {
  currency: string;
  wallets: readonly FactsWallet[];
  transactions: readonly FactsTransaction[];
  overrides?: readonly RecurringOverride[];
  categoryNames?: Record<string, string>;
  days: readonly Date[];
}): BacktestResult {
  const liquid = liquidWallets(input.wallets, input.currency);
  const lastDay = Math.max(...input.transactions.map((tx) => dayNumber(tx.transactionDate)));
  let evaluated = 0;
  let inside = 0;
  for (const now of input.days) {
    const known = input.transactions.filter((tx) => new Date(tx.transactionDate) <= now);
    const series = detectRecurring(known, input.overrides ?? [], now, input.categoryNames).filter(
      (s) => s.currency === input.currency,
    );
    const payday = pickPayday(series);
    const forecast = forecastCurrency({
      currency: input.currency,
      wallets: input.wallets.map((w) => ({ ...w, balanceConfirmedAt: now.toISOString() })),
      transactions: known,
      series,
      payday,
      now,
    });
    if (forecast.status !== 'ready') continue;
    const horizonDay = dayNumber(forecast.horizonDate) + (forecast.horizon === 'payday' ? 0 : 1);
    if (horizonDay > lastDay) continue;
    const paid = input.transactions
      .filter(
        (tx) => payday && tx.transactionDate > now.toISOString() && seriesKey(tx) === payday.key,
      )
      .map((tx) => dayNumber(tx.transactionDate));
    const endDay = Math.min(horizonDay, ...paid);
    const actual = minorToNumber(
      balanceMinor(liquid, input.transactions, new Date(dayStart(endDay).getTime() - 1)),
    );
    evaluated += 1;
    if (actual >= forecast.endBalance.low && actual <= forecast.endBalance.high) inside += 1;
  }
  return { evaluated, inside, share: evaluated ? inside / evaluated : 0 };
}
