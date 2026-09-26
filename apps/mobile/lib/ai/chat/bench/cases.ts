/**
 * Chat bench questions over the fixture ledger. `facts` pin snapshot values a correct reply
 * must quote (a `null` fact pins a field that must stay empty). `refuse` marks questions the
 * snapshot cannot answer. `reference` is a reply `scoreReply` must accept; a live model's reply
 * would be scored the same way.
 */
import type { FinanceAssistantToolSnapshot } from '@/lib/ai/snapshot/finance-metrics';
import { buildBenchSnapshot, type BenchFixture } from './fixture';
import { checkGrounding, citedNumbers, matches } from './grounding';

export type BenchFact = {
  currency: string;
  path: string;
  value: number | string | boolean | null;
};

export type ChatBenchCase = {
  id: string;
  fixture?: BenchFixture;
  question: string;
  facts: BenchFact[];
  refuse?: boolean;
  reference: string;
};

const REFUSAL =
  /\b(can't|cannot|can not|don't have|don't see|doesn't|isn't|aren't|not able|unable|not available|no fair|no reliable|not tracked|no data)\b/i;
const MAX_REPLY_WORDS = 150;
const INTERNAL_NAME =
  /\bnull\b|\bsnapshot\b|calendarMonth|rolling30|pendingProposals|dailyPace|endBalance|needsConfirm|fitsWorstCase|worstCaseAfter|likelyAfter|changeLast30Days/i;

/** The snapshot the app would send with this question. */
export function benchSnapshot(benchCase: ChatBenchCase): FinanceAssistantToolSnapshot {
  return buildBenchSnapshot(benchCase.fixture, benchCase.question);
}

export function factValue(snapshot: FinanceAssistantToolSnapshot, fact: BenchFact): unknown {
  return fact.path
    .split('.')
    .reduce<unknown>(
      (node, key) => (node as Record<string, unknown> | undefined)?.[key],
      snapshot.currencies[fact.currency],
    );
}

/** Empty when the reply is grounded, quotes every pinned fact, refuses when it must, and reads like chat. */
export function scoreReply(
  benchCase: ChatBenchCase,
  snapshot: FinanceAssistantToolSnapshot,
  reply: string,
): string[] {
  const failures = checkGrounding(reply, snapshot, benchCase.question).map(
    (issue) => `${issue.kind}: ${issue.value}`,
  );
  const cited = citedNumbers(reply);
  for (const { currency, path, value } of benchCase.facts) {
    if (value === null || typeof value === 'boolean') continue;
    const quoted =
      typeof value === 'string'
        ? reply.toLowerCase().includes(value.toLowerCase())
        : cited.some(
            (n) => (n.currency ?? currency) === currency && matches(n.value, Math.abs(value)),
          );
    if (!quoted) failures.push(`missing ${currency} ${path}`);
  }
  if (benchCase.refuse && !REFUSAL.test(reply)) failures.push('answered without the data');
  const words = reply.trim().split(/\s+/).length;
  if (words > MAX_REPLY_WORDS) failures.push(`too long: ${words} words`);
  if (INTERNAL_NAME.test(reply)) failures.push('leaks an internal field name');
  return failures;
}

const MYR = 'MYR';
const SGD = 'SGD';

export const CHAT_BENCH_CASES: ChatBenchCase[] = [
  {
    id: 'month-to-date-myr',
    question: 'How much have I spent this month?',
    facts: [
      { currency: MYR, path: 'calendarMonth.expenseCurrentMonthToDate', value: 1872.8 },
      { currency: SGD, path: 'calendarMonth.expenseCurrentMonthToDate', value: 18.5 },
    ],
    reference:
      'So far in October you have spent MYR 1,872.80 and, separately, SGD 18.50. I keep each currency apart.',
  },
  {
    id: 'previous-month',
    question: 'What did I spend last month?',
    facts: [{ currency: MYR, path: 'calendarMonth.expensePreviousCalendarMonth', value: 1805.6 }],
    reference: 'In September you spent RM 1,805.60.',
  },
  {
    id: 'rent-day-one-pace',
    question: 'Is rent going to blow up my month?',
    refuse: true,
    facts: [
      { currency: MYR, path: 'calendarMonth.dailyPaceVsPreviousMonthPct', value: null },
      { currency: MYR, path: 'rolling30.largestExpense.amount', value: 1500 },
    ],
    reference:
      'Rent of RM 1,500 is your largest expense and most of October so far, so I cannot give a fair pace comparison with September yet.',
  },
  {
    id: 'where-did-money-go',
    question: 'Where did my money go?',
    facts: [
      { currency: MYR, path: 'rolling30.topCategories.0.name', value: 'Housing' },
      { currency: MYR, path: 'rolling30.topCategories.1.amount', value: 397 },
    ],
    reference:
      'Over the last 30 days Housing took RM 1,500 and Groceries RM 397 out of RM 2,123.40 spent.',
  },
  {
    id: 'largest-expense',
    question: 'What was my biggest expense?',
    facts: [{ currency: MYR, path: 'rolling30.largestExpense.merchant', value: 'Landlord' }],
    reference: 'Your biggest expense was RM 1,500 to Landlord for Housing.',
  },
  {
    id: 'grocery-budget',
    question: 'How is my grocery budget?',
    facts: [
      { currency: MYR, path: 'budgetCoach.categories.1.spentTotal', value: 186.4 },
      { currency: MYR, path: 'budgetCoach.categories.1.pctOfBudget', value: 31.1 },
    ],
    reference: 'You have used MYR 186.40 of your MYR 600 grocery budget, about 31.1%.',
  },
  {
    id: 'grocery-left',
    question: 'How much is left in my grocery budget?',
    facts: [{ currency: MYR, path: 'budgetCoach.categories.1.remaining', value: 413.6 }],
    reference: 'MYR 413.60 is left in your groceries budget this month.',
  },
  {
    id: 'food-budget-myr',
    question: 'Am I over budget on food?',
    facts: [
      { currency: MYR, path: 'budgetCoach.categories.0.pctOfBudget', value: 6 },
      { currency: SGD, path: 'budgetCoach.categories.0.pctOfBudget', value: 6.5 },
    ],
    reference:
      'No. Your MYR food budget is 6% used (MYR 18 of MYR 300) and your SGD food budget is 6.5% used (SGD 6.50 of SGD 100).',
  },
  {
    id: 'sgd-spend',
    question: 'How much did I spend in Singapore dollars?',
    facts: [{ currency: SGD, path: 'rolling30.current.expenseTotal', value: 78.4 }],
    reference: 'In the last 30 days you spent SGD 78.40.',
  },
  {
    id: 'income',
    question: 'How much came in over the last month?',
    facts: [{ currency: MYR, path: 'rolling30.current.incomeTotal', value: 4589.9 }],
    reference: 'MYR 4,589.90 came in over the last 30 days.',
  },
  {
    id: 'daily-average',
    question: 'What is my daily average spend?',
    facts: [{ currency: MYR, path: 'rolling30.rates.dailyExpense', value: 70.78 }],
    reference: 'Your daily average over 30 days is RM 70.78.',
  },
  {
    id: 'savings-rate',
    question: 'What is my savings rate?',
    facts: [
      { currency: MYR, path: 'rolling30.rates.savingsMargin', value: 53.7 },
      { currency: MYR, path: 'rolling30.current.net', value: 2466.5 },
    ],
    reference: 'You kept 53.7% of your MYR income, a net of MYR 2,466.50 over 30 days.',
  },
  {
    id: 'vs-prior-30',
    question: 'Am I spending more than before?',
    facts: [{ currency: MYR, path: 'rolling30.deltas.expensePctVsPrior', value: 36.6 }],
    reference: 'Yes: MYR spending is up 36.6% on the previous 30 days.',
  },
  {
    id: 'transfer-not-spending',
    question: 'Did moving RM500 to savings count as spending?',
    facts: [{ currency: MYR, path: 'rolling30.current.expenseTotal', value: 2123.4 }],
    reference:
      'No. Transfers between your own wallets are left out, so the RM500 is not in your RM 2,123.40 of spending.',
  },
  {
    id: 'top-merchant',
    question: 'Which merchant do I spend the most at?',
    facts: [{ currency: MYR, path: 'rolling30.topMerchants.1.name', value: 'Jaya Grocer' }],
    reference: 'After rent to Landlord, Jaya Grocer is your top merchant at RM 397.',
  },
  {
    id: 'pending',
    question: 'Did you count the lunch I just logged?',
    facts: [{ currency: MYR, path: 'pendingProposals.expenseTotal', value: 12 }],
    reference:
      'Not yet. 1 logged expense of RM 12 is waiting for your review, and it is not in the totals until you approve it.',
  },
  {
    id: 'usd',
    question: 'Did I spend anything in US dollars?',
    facts: [{ currency: 'USD', path: 'rolling30.current.expenseTotal', value: 2.99 }],
    reference: 'Yes, USD 2.99 on Entertainment.',
  },
  {
    id: 'all-currencies-total',
    question: 'What is my total spending across all currencies?',
    refuse: true,
    facts: [],
    reference:
      'I keep each currency separate and do not convert between them, so I cannot give one total. Ask about MYR, SGD or USD on its own.',
  },
  {
    id: 'subscriptions',
    question: 'What subscriptions am I paying for?',
    facts: [
      { currency: MYR, path: 'facts.recurring.2.name', value: 'Netflix' },
      { currency: MYR, path: 'facts.recurring.2.amount', value: 55 },
    ],
    reference:
      'You pay Netflix RM 55 a month, next due on 10 November. Your other regular payment is rent of RM 1,500 to Landlord.',
  },
  {
    id: 'afford',
    question: 'Can I afford RM800?',
    facts: [{ currency: MYR, path: 'facts.forecast.afford.worstCaseAfter', value: 7552.96 }],
    reference:
      'Yes. Even if your spending runs high, you would still have about RM 7,552.96 left before your salary on 25 October. This is informational, not financial advice.',
  },
  {
    id: 'payday',
    question: 'Will I make it to payday?',
    facts: [
      { currency: MYR, path: 'facts.forecast.endBalance.low', value: 8352.96 },
      { currency: MYR, path: 'facts.forecast.endBalance.high', value: 8751.5 },
    ],
    reference:
      'Yes. Before your salary on 25 October you should have between RM 8,352.96 and RM 8,751.50 in your cash and bank accounts.',
  },
  {
    id: 'next-payday',
    question: 'When is my next payday?',
    facts: [{ currency: MYR, path: 'facts.payday.amount', value: 4500 }],
    reference: 'Your salary of RM 4,500 from Acme Sdn Bhd looks due on 25 October.',
  },
  {
    id: 'afford-too-much',
    question: 'Can I afford RM9000?',
    facts: [
      { currency: MYR, path: 'facts.forecast.startBalance', value: 8751.5 },
      { currency: MYR, path: 'facts.forecast.afford.fitsWorstCase', value: false },
      { currency: MYR, path: 'facts.forecast.afford.worstCaseAfter', value: -647.04 },
    ],
    reference:
      'No. You have RM 8,751.50 in cash and bank accounts, so RM9000 could leave you about RM 647.04 short before payday. This is informational, not financial advice.',
  },
  {
    id: 'balance-lower',
    question: 'Why is my balance lower than I expected?',
    facts: [
      { currency: MYR, path: 'facts.balances.liquid', value: 8751.5 },
      { currency: MYR, path: 'facts.balances.changeLast30Days', value: 2466.5 },
    ],
    reference:
      'Over the last 30 days it actually rose: your cash and bank balance is RM 8,751.50, up RM 2,466.50. The biggest payment was rent of RM 1,500 on 1 October.',
  },
  {
    id: 'sgd-forecast',
    question: 'Will my SGD last until the end of the month?',
    refuse: true,
    facts: [],
    reference:
      "I can't forecast your SGD yet: there is not enough SGD history and its balance hasn't been confirmed recently. Confirming the balance on the wallet screen would help.",
  },
  {
    id: 'usd-month-end',
    question: 'How much USD will I have at the end of the month?',
    refuse: true,
    facts: [{ currency: 'USD', path: 'facts.balances.liquid', value: 1407.01 }],
    reference:
      "I can't forecast your USD to month end: your freelance income arrives without a regular payday. You have USD 1,407.01 now.",
  },
  {
    id: 'gig-payday',
    question: 'When will my next USD freelance payment arrive?',
    refuse: true,
    facts: [{ currency: 'USD', path: 'facts.payday', value: null }],
    reference:
      "I can't tell: your Upwork payments arrive at irregular times and amounts, so there is no regular USD payday to predict.",
  },
  {
    id: 'salaried-afford-3000',
    fixture: 'salaried',
    question: 'Can I afford a RM3,000 laptop?',
    facts: [
      { currency: MYR, path: 'facts.forecast.afford.fitsWorstCase', value: false },
      { currency: MYR, path: 'facts.forecast.afford.worstCaseAfter', value: -122.33 },
    ],
    reference:
      'Not safely. After a RM3,000 laptop you would most likely have RM 88.32 left before your salary on 25 October, and if spending runs high you could be RM 122.33 short. This is informational, not financial advice.',
  },
  {
    id: 'salaried-bills-before-payday',
    fixture: 'salaried',
    question: 'Which bills are due before payday?',
    facts: [
      { currency: MYR, path: 'facts.forecast.bills.0.amount', value: 99.85 },
      { currency: MYR, path: 'facts.forecast.bills.1.amount', value: 129 },
    ],
    reference:
      'Two: TNB about RM 99.85 on 15 October and Unifi RM 129 on 18 October, RM 228.85 together. Rent is next due on 1 November, after payday.',
  },
  {
    id: 'gig-afford',
    fixture: 'gig',
    question: 'Can I afford RM300 this week?',
    refuse: true,
    facts: [{ currency: MYR, path: 'facts.balances.liquid', value: 4403.15 }],
    reference:
      "I can't say for sure: your payouts arrive without a regular payday, so there is no range to check RM300 against. You have RM 4,403.15 in Touch n Go now, and rent of RM 650 is due on 1 November. This is informational, not financial advice.",
  },
  {
    id: 'debts',
    question: 'How much do I owe people?',
    refuse: true,
    facts: [],
    reference: 'I cannot see your debts yet. The Debts screen lists them.',
  },
];
