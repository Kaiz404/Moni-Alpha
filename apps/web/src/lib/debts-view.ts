import {
  dateLabel,
  dayLabel,
  dueWords,
  formatMoney,
  type DebtLine,
  type DebtSummary,
  type FinanceDebtActivity,
} from '@repo/core';

/** The mint strip's heading for the net position. */
export function netLabel(summary: Pick<DebtSummary, 'netMinor'>): string {
  if (summary.netMinor > 0) return 'Overall, you are owed';
  if (summary.netMinor < 0) return 'Overall, you owe';
  return 'Everyone is square';
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** A Coming up row: "Pay Mei RM40" or "Aiman pays RM150", then "In 6 days · concert tickets". */
export function comingUpWords(line: DebtLine, daysLeft: number): { title: string; meta: string } {
  const { debt, balanceMinor } = line;
  const amount = formatMoney(balanceMinor, debt.currency, { whole: true });
  const title = debt.direction === 'i_owe' ? `Pay ${debt.counterpartyName} ${amount}` : `${debt.counterpartyName} pays ${amount}`;
  return { title, meta: [dueWords(daysLeft), debt.note ? lowerFirst(debt.note) : null].filter(Boolean).join(' · ') };
}

/** The People row's line under the name: "Lent Sun 27 Sep", or for a closed debt "Settled · Lunch". */
export function personMeta(line: DebtLine, today: string, startedDay: string): string {
  if (line.state === 'open') return `${line.debt.direction === 'owed_to_me' ? 'Lent' : 'Borrowed'} ${dateLabel(startedDay, today)}`;
  const state = line.state === 'settled' ? 'Settled' : 'Written off';
  return line.debt.note ? `${state} · ${line.debt.note}` : state;
}

/** "Open · 2 people": the people, not the debts, with something still open. */
export function openLabel(open: readonly DebtLine[]): string {
  const people = new Set(open.map((line) => line.debt.counterpartyName.trim().toLocaleLowerCase())).size;
  return `Open · ${people} ${people === 1 ? 'person' : 'people'}`;
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

export type TimelineItem = {
  id: string;
  kind: FinanceDebtActivity['kind'];
  title: string;
  meta: string;
  /** Signed for money that came in: "+RM50.00" on a debt owed to the user. */
  amount: string;
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
            meta: `${day} · ${wallet ? `${mine ? 'from' : 'into'} ${wallet}` : `${name} paid directly`}`,
            amount: money,
          };
        case 'repayment':
          return {
            id: activity.id,
            kind: activity.kind,
            title: mine ? 'Paid you back' : 'You paid back',
            meta: wallet ? `${day} · ${mine ? 'into' : 'from'} ${wallet}` : day,
            amount: mine ? `+${money}` : money,
          };
        case 'write_off':
          return { id: activity.id, kind: activity.kind, title: 'Written off', meta: day, amount: money };
      }
    });
}
