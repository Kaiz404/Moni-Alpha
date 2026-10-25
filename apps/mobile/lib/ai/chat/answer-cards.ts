/**
 * Answer cards are picked and filled on the phone from the ledger, so their
 * numbers never come from the model; the model's reply is only the caption.
 * Amounts are minor units of the snapshot's currency.
 */
import type { DebtDue } from '@/lib/finance/budget-month';

export type BillLine ={ name: string; amount: number; dueDate: string };

export type AnswerCard =
  | { kind: 'category_spend'; categoryId: string; spent: number; budget: number | null }
  | {
      kind: 'budget_progress';
      spent: number;
      budget: number;
      left: number;
      daysLeft: number;
      perDay: number | null;
    }
  | {
      kind: 'bill_due';
      seriesKey: string;
      name: string;
      amount: number;
      dueDate: string;
      /** The rest are absent on cards saved before the bill timeline. */
      walletName?: string | null;
      /** Every bill still due this month from this one on, soonest first. */
      ahead?: BillLine[];
      /** Money owed to people this month, which safe to spend a day also holds back. */
      owed?: DebtDue[];
      perDay?: number | null;
    }
  /** The captures waiting when the user asked; each row settles in place. */
  | { kind: 'captures'; proposalIds: string[] };

export type AnswerSnapshot = {
  currency: string;
  categories: readonly {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    spent: number;
    budget: number | null;
  }[];
  /** This month in the main currency; null fields without a budget. */
  month: {
    spent: number;
    budget: number | null;
    left: number | null;
    daysLeft: number;
    perDay: number | null;
    owed: readonly DebtDue[];
  };
  /** Bills still due this month, soonest first. */
  bills: readonly {
    seriesKey: string;
    name: string;
    amount: number;
    dueDate: string;
    walletName: string | null;
  }[];
  /** Captures waiting for review, newest first. */
  waiting: readonly string[];
};

const CAPTURE_WORDS = /\b(captures?|to review)\b/;
const BILL_WORDS = /\b(bills?|due|subscriptions?|renews?|goes? out)\b/;
const BUDGET_WORDS = /\b(left|budget|on track|a day|per day|today|afford|spend)\b/;

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

/** Every word of the name, or its first word when that is distinctive ("Food & Dining" → food). */
function mentions(question: string[], name: string): number {
  const parts = words(name).filter((word) => word.length > 2);
  if (!parts.length) return 0;
  if (parts.every((part) => question.includes(part))) return parts.join(' ').length;
  return question.includes(parts[0]!) ? parts[0]!.length : 0;
}

function best<T extends { name: string }>(question: string[], items: readonly T[]): T | null {
  let found: T | null = null;
  let score = 0;
  for (const item of items) {
    const next = mentions(question, item.name);
    if (next > score) {
      found = item;
      score = next;
    }
  }
  return found;
}

/** The card a question asks for, filled from `snapshot`, or null when plain text fits better. */
export function pickAnswerCard(question: string, snapshot: AnswerSnapshot): AnswerCard | null {
  const asked = words(question);
  const text = asked.join(' ');

  if (CAPTURE_WORDS.test(text)) return { kind: 'captures', proposalIds: [...snapshot.waiting] };

  const billCard = (bill: AnswerSnapshot['bills'][number]): AnswerCard => ({
    kind: 'bill_due',
    seriesKey: bill.seriesKey,
    name: bill.name,
    amount: bill.amount,
    dueDate: bill.dueDate,
    walletName: bill.walletName,
    ahead: snapshot.bills
      .filter((other) => other.dueDate >= bill.dueDate)
      .map(({ name, amount, dueDate }) => ({ name, amount, dueDate })),
    owed: [...snapshot.month.owed],
    perDay: snapshot.month.perDay,
  });

  const bill = best(asked, snapshot.bills);
  if (bill) return billCard(bill);

  const category = best(asked, snapshot.categories);
  if (category)
    return {
      kind: 'category_spend',
      categoryId: category.id,
      spent: category.spent,
      budget: category.budget,
    };

  const next = snapshot.bills[0];
  if (next && BILL_WORDS.test(text)) return billCard(next);

  const { month } = snapshot;
  if (month.budget !== null && month.left !== null && BUDGET_WORDS.test(text))
    return {
      kind: 'budget_progress',
      spent: month.spent,
      budget: month.budget,
      left: month.left,
      daysLeft: month.daysLeft,
      perDay: month.perDay,
    };

  return null;
}
