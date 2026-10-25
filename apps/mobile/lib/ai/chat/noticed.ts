import { formatMoney } from '@/lib/finance/format-money';
import { dueWhen } from '@/lib/finance/spent-summary';
import { resolveTransactionIcon } from '@/lib/transactions/icon';

import type { AnswerSnapshot } from './answer-cards';
import type { NoticedItem } from './messages';

/** What Moni points out when today's thread opens: an overspent category, waiting captures, the next bill. */
export function noticedItems(
  snapshot: AnswerSnapshot,
  waiting: { count: number; amount: number },
  now: Date,
): NoticedItem[] {
  const money = (minor: number) => formatMoney(minor, snapshot.currency);
  const whole = (minor: number) => formatMoney(minor, snapshot.currency, { whole: true });
  const items: NoticedItem[] = [];

  const over = snapshot.categories
    .filter((category) => category.budget !== null && category.spent > category.budget)
    .sort((a, b) => b.spent - b.budget! - (a.spent - a.budget!))[0];
  if (over) {
    const by = whole(over.spent - over.budget!);
    items.push({
      title: `${over.name} is ${by} over`,
      meta: `${whole(over.spent)} of your ${whole(over.budget!)} budget`,
      icon: resolveTransactionIcon(over.icon, 'expense'),
      tint: { color: over.color ?? null },
      target: { kind: 'ask', question: `Why is ${over.name} ${by} over?` },
    });
  }

  if (waiting.count > 0)
    items.push({
      title: `${waiting.count} ${waiting.count === 1 ? 'capture' : 'captures'} to review`,
      meta: `${money(waiting.amount)} · not in your totals yet`,
      icon: 'inbox-arrow-down',
      tint: 'lilac',
      target: { kind: 'review' },
    });

  const bill = snapshot.bills[0];
  if (bill)
    items.push({
      title: `${bill.name} is due ${dueWhen(bill.dueDate, now)}`,
      meta: bill.walletName ? `${money(bill.amount)} from ${bill.walletName}` : money(bill.amount),
      icon: 'repeat',
      tint: 'lemon',
      target: { kind: 'ask', question: `When does ${bill.name} go out?` },
    });

  return items;
}
