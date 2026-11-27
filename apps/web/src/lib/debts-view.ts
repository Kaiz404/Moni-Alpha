import {
  dateLabel,
  dayLabel,
  dueWords,
  formatMoney,
  tickedChoices,
  type DebtLine,
  type DebtSide,
  type DebtStatusChoice,
  type DebtSummary,
  type FinanceDebtActivity,
} from '@repo/core';
import type { MinorAmount } from '@repo/types';

/** Money on the Debts screen, as the phone writes it: whole ringgit when there are no sen. */
export function debtMoney(minor: number, currency: string): string {
  return formatMoney(minor, currency, { whole: minor % 100 === 0 });
}

/** The mint strip's heading for the net position. */
export function netLabel(summary: Pick<DebtSummary, 'netMinor'>): string {
  if (summary.netMinor > 0) return 'Overall, you are owed';
  if (summary.netMinor < 0) return 'Overall, you owe';
  return 'Everyone is square';
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** A Coming up row: "Pay Mei RM40" or "Aiman pays RM150", then "In 6 days, concert tickets". */
export function comingUpWords(line: DebtLine, daysLeft: number): { title: string; meta: string } {
  const { debt, balanceMinor } = line;
  const amount = formatMoney(balanceMinor, debt.currency, { whole: true });
  const title = debt.direction === 'i_owe' ? `Pay ${debt.counterpartyName} ${amount}` : `${debt.counterpartyName} pays ${amount}`;
  return { title, meta: [dueWords(daysLeft), debt.note ? lowerFirst(debt.note) : null].filter(Boolean).join(', ') };
}

/**
 * A debt row's line under the name: what it is for ("Concert tickets"), else when it started ("Lent Sun 27 Sep",
 * "Noted Thu 1 Oct" when no money moved), or for a closed debt "Settled, Lunch".
 */
export function personMeta(line: DebtLine, today: string, startedDay: string): string {
  if (line.state === 'open') return line.debt.note ?? `${line.noted ? 'Noted' : line.debt.direction === 'owed_to_me' ? 'Lent' : 'Borrowed'} ${dateLabel(startedDay, today)}`;
  const state = line.state === 'settled' ? 'Settled' : 'Written off';
  return line.debt.note ? `${state}, ${line.debt.note}` : state;
}

/** "3 open debts": each debt counts once, even two with one person. */
export function openLabel(open: readonly DebtLine[]): string {
  return debtCount(open.length, 'open ');
}

function debtCount(count: number, kind = ''): string {
  return `${count} ${kind}${count === 1 ? 'debt' : 'debts'}`;
}

/** The bar under the balance: what came back so far, and what is still to go. */
export function repaidWords(line: DebtLine): { left: string; right: string } {
  const money = (minor: number) => formatMoney(minor, line.debt.currency);
  if (line.state === 'written_off') return { left: `${money(line.repaidMinor)} of ${money(line.principalMinor)} paid back`, right: 'Written off' };
  return {
    left: line.repaidMinor > 0 ? `${money(line.repaidMinor)} of ${money(line.principalMinor)} paid back` : 'Nothing paid back yet',
    right: line.balanceMinor > 0 ? `${money(line.balanceMinor)} to go` : 'Paid in full',
  };
}

/** The confirm before a write-off, in the phone's words: who stops owing and what stays. */
export function writeOffWords(line: DebtLine): { title: string; line: string } {
  const name = line.debt.counterpartyName;
  return {
    title: `Write off ${formatMoney(line.balanceMinor, line.debt.currency)}?`,
    line: `${line.debt.direction === 'owed_to_me' ? `${name} won't owe you anything` : `You won't owe ${name} anything`}. No money moves, and this history stays.`,
  };
}

/** The confirm before deleting a debt: what goes, and on an open debt how Write off differs. */
export function deleteWords(line: DebtLine): { title: string; line: string } {
  return {
    title: `Delete the debt with ${line.debt.counterpartyName}?`,
    line: line.state === 'open' ? 'Its history and wallet entries go too, where Write off would keep them.' : 'Its history and wallet entries go too.',
  };
}

export type TimelineItem = {
  id: string;
  kind: FinanceDebtActivity['kind'];
  title: string;
  meta: string;
  /** Signed for money that came in: "+RM50.00" on a debt owed to the user. */
  amount: string;
  amountMinor: MinorAmount;
};

/** The pane's history, newest first: each activity in the debt's words. */
export function timeline(
  line: DebtLine,
  activities: readonly FinanceDebtActivity[],
  { today, dayOf, walletName }: { today: string; dayOf: (iso: string) => string; walletName: (id: string | null) => string | null },
): TimelineItem[] {
  const mine = line.debt.direction === 'owed_to_me';
  const name = line.debt.counterpartyName;
  return [...activities]
    .sort((a, b) => b.activityDate.localeCompare(a.activityDate))
    .map((activity) => {
      const day = dayLabel(dayOf(activity.activityDate), today);
      const wallet = walletName(activity.walletId);
      const money = formatMoney(activity.amountMinor, line.debt.currency);
      switch (activity.kind) {
        case 'principal':
          return {
            id: activity.id,
            kind: activity.kind,
            title: mine ? 'Lent' : 'Borrowed',
            meta: wallet ? `${day} ${mine ? 'from' : 'into'} ${wallet}` : mine ? day : `${day}, ${name} paid directly`,
            amount: money,
            amountMinor: activity.amountMinor,
          };
        case 'repayment':
          return {
            id: activity.id,
            kind: activity.kind,
            title: mine ? 'Paid you back' : 'You paid back',
            meta: wallet ? `${day} ${mine ? 'into' : 'from'} ${wallet}` : day,
            amount: mine ? `+${money}` : money,
            amountMinor: activity.amountMinor,
          };
        case 'write_off':
          return { id: activity.id, kind: activity.kind, title: 'Written off', meta: day, amount: money, amountMinor: activity.amountMinor };
      }
    });
}

export const SIDE_LABEL: Record<DebtSide, string> = { owed_to_me: 'Owed to you', i_owe: 'You owe' };
export const STATUS_LABEL: Record<DebtStatusChoice, string> = { open: 'Open', closed: 'Settled' };

/** A filter chip's value: its default when every choice is ticked, else the one choice ticked. */
export function tickedLabel<T extends string>(picked: readonly T[], labels: Record<T, string>, every: string): string {
  return picked.length === 1 ? labels[picked[0]!] : every;
}

/**
 * Ticks or unticks one choice. Ticking every one reads as no filter (an empty list), and the last
 * ticked choice stays ticked, as the phone's Apply waits for at least one.
 */
export function toggleChoice<T extends string>(picked: readonly T[], value: T, every: readonly T[]): T[] {
  const ticked = tickedChoices(picked, every);
  const next = ticked.includes(value) ? ticked.filter((choice) => choice !== value) : every.filter((choice) => choice === value || ticked.includes(choice));
  if (next.length === 0) return [...picked];
  return next.length === every.length ? [] : next;
}

/** A filter in the address: `owed_to_me,i_owe`, read back to the known choices only. */
export function readChoices<T extends string>(value: string | null, every: readonly T[]): T[] {
  const picked = (value ?? '').split(',');
  return every.filter((choice) => picked.includes(choice));
}

export type FilterOption<T extends string> = { value: T; label: string; meta: string };

/** Owed to you and You owe, each with its amount, as the phone's picker. */
export function sideOptions(summary: Pick<DebtSummary, 'owedToMeMinor' | 'iOweMinor' | 'currency'>): FilterOption<DebtSide>[] {
  return [
    { value: 'owed_to_me', label: SIDE_LABEL.owed_to_me, meta: debtMoney(summary.owedToMeMinor, summary.currency) },
    { value: 'i_owe', label: SIDE_LABEL.i_owe, meta: debtMoney(summary.iOweMinor, summary.currency) },
  ];
}

export function statusOptions(summary: Pick<DebtSummary, 'open' | 'closed'>): FilterOption<DebtStatusChoice>[] {
  return [
    { value: 'open', label: 'Open', meta: debtCount(summary.open.length) },
    { value: 'closed', label: 'Settled and written off', meta: debtCount(summary.closed.length) },
  ];
}

/** The hero's bar: each side sized by what is open on it, a side with nothing left out; null when nothing is open. */
export function owedBar(summary: Pick<DebtSummary, 'owedToMeMinor' | 'iOweMinor'>): { side: DebtSide; flex: number }[] | null {
  const parts = [
    { side: 'owed_to_me' as const, flex: summary.owedToMeMinor as number },
    { side: 'i_owe' as const, flex: summary.iOweMinor as number },
  ].filter((part) => part.flex > 0);
  return parts.length ? parts : null;
}

/** A debt's wallet choice: a wallet's id, `NO_WALLET` when no money moved, or null before one is chosen. */
export const NO_WALLET = 'none';

/** Where a debt's money went, in the phone's words for each side. */
export const WALLET_WORDS: Record<DebtSide, { principal: string; repay: string; principalNone: string; repayNone: string }> = {
  owed_to_me: { principal: 'Lent from', repay: 'Paid into', principalNone: "Money didn't leave my wallet", repayNone: "Money didn't reach my wallet" },
  i_owe: { principal: 'Borrowed into', repay: 'Paid from', principalNone: "Money didn't reach my wallet", repayNone: "Money didn't leave my wallet" },
};

/** The wallet field's label and value: "Wallet" and "Not used" when no money moved, else the side's label and the wallet. */
export function walletField(label: string, choice: string | null, walletName: (id: string) => string | undefined): { label: string; value: string | null } {
  if (choice === NO_WALLET) return { label: 'Wallet', value: 'Not used' };
  return { label, value: choice ? (walletName(choice) ?? null) : null };
}

/**
 * The wallet a repayment starts on: one this debt already moved through, else none chosen for a debt
 * recorded with no wallet, else the usual wallet.
 */
export function repayWallet(
  line: Pick<DebtLine, 'noted'>,
  activities: readonly Pick<FinanceDebtActivity, 'walletId'>[],
  walletIds: readonly string[],
  usual: string | null,
): string | null {
  const used = activities.find((activity) => activity.walletId !== null && walletIds.includes(activity.walletId))?.walletId;
  return used ?? (line.noted ? null : usual);
}

/** The repayment's button: what is still missing, or what it records. */
export function repayAction(amount: string | null, choice: string | null): string {
  if (amount === null) return 'Add an amount';
  if (choice === null) return 'Choose where it went';
  return `Record ${amount}`;
}
