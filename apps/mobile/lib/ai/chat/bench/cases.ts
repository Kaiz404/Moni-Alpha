/**
 * Chat bench questions over the fixture ledger. `facts` pin snapshot values a correct reply
 * must quote (a `null` fact pins a field that must stay empty). `refuse` marks questions the
 * snapshot cannot answer. `reference` is a reply `scoreReply` must accept; a live model's reply
 * would be scored the same way.
 */
import type { FinanceAssistantToolSnapshot } from '@/lib/ai/snapshot/finance-metrics';
import { checkGrounding, citedNumbers, matches } from './grounding';

export type BenchFact = { currency: string; path: string; value: number | string | null };

export type ChatBenchCase = {
  id: string;
  question: string;
  facts: BenchFact[];
  refuse?: boolean;
  reference: string;
};

const REFUSAL = /\b(can't|cannot|don't have|don't see|not able)\b/i;

export function factValue(snapshot: FinanceAssistantToolSnapshot, fact: BenchFact): unknown {
  return fact.path
    .split('.')
    .reduce<unknown>(
      (node, key) => (node as Record<string, unknown> | undefined)?.[key],
      snapshot.currencies[fact.currency],
    );
}

/** Empty when the reply is grounded, quotes every pinned fact, and refuses when it must. */
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
    if (value === null) continue;
    const quoted =
      typeof value === 'string'
        ? reply.toLowerCase().includes(value.toLowerCase())
        : cited.some((n) => (n.currency ?? currency) === currency && matches(n.value, value));
    if (!quoted) failures.push(`missing ${currency} ${path}`);
  }
  if (benchCase.refuse && !REFUSAL.test(reply)) failures.push('answered without the data');
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
    facts: [{ currency: MYR, path: 'calendarMonth.expensePreviousCalendarMonth', value: 1750.6 }],
    reference: 'In September you spent RM 1,750.60.',
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
    facts: [{ currency: MYR, path: 'rolling30.deltas.expensePctVsPrior', value: 41.6 }],
    reference: 'Yes: MYR spending is up 41.6% on the previous 30 days.',
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
    facts: [
      { currency: MYR, path: 'pendingProposals.count', value: 1 },
      { currency: MYR, path: 'pendingProposals.expenseTotal', value: 12 },
    ],
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
    refuse: true,
    facts: [],
    reference:
      'I cannot detect recurring payments yet, so I cannot list your subscriptions. Tagging them would help.',
  },
  {
    id: 'afford',
    question: 'Can I afford RM800?',
    refuse: true,
    facts: [],
    reference:
      'I cannot see your wallet balances, so I cannot tell whether RM800 fits. Check the balance of the wallet you would pay from.',
  },
  {
    id: 'payday',
    question: 'Will I make it to payday?',
    refuse: true,
    facts: [],
    reference:
      'I cannot see your balances or when your salary arrives, so I cannot tell. Your wallet screen shows current balances.',
  },
  {
    id: 'debts',
    question: 'How much do I owe people?',
    refuse: true,
    facts: [],
    reference: 'I cannot see your debts yet. The Debts screen lists them.',
  },
];
