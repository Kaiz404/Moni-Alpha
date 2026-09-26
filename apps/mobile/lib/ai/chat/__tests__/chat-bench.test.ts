import { benchSnapshot, CHAT_BENCH_CASES, factValue, scoreReply } from '@/lib/ai/chat/bench/cases';
import { buildBenchSnapshot } from '@/lib/ai/chat/bench/fixture';
import { checkGrounding, citedNumbers } from '@/lib/ai/chat/bench/grounding';

const snapshot = buildBenchSnapshot();
const benchCase = (id: string) => CHAT_BENCH_CASES.find((c) => c.id === id)!;

describe('chat bench fixture', () => {
  it('holds 31 cases', () => {
    expect(CHAT_BENCH_CASES).toHaveLength(31);
    expect(new Set(CHAT_BENCH_CASES.map((c) => c.id)).size).toBe(31);
  });

  it('keeps MYR, SGD and USD apart and leaves the transfer out of spending', () => {
    expect(Object.keys(snapshot.currencies)).toEqual(['MYR', 'SGD', 'USD']);
    expect(snapshot.currencies.MYR.rolling30.current.expenseTotal).toBe(2123.4);
  });

  describe.each(CHAT_BENCH_CASES)('$id', (c) => {
    const caseSnapshot = benchSnapshot(c);

    it('snapshot holds the pinned facts', () => {
      for (const fact of c.facts) {
        expect([fact.path, factValue(caseSnapshot, fact)]).toEqual([fact.path, fact.value]);
      }
    });

    it('reference answer scores clean', () => {
      expect(scoreReply(c, caseSnapshot, c.reference)).toEqual([]);
    });
  });
});

describe('grounding checker', () => {
  it('reads currency-tagged and bare numbers, ignoring dates and times', () => {
    expect(
      citedNumbers('On October 1 at 09:00 you paid RM1,500.00, S$ 6.50 and 12 MYR (31.1%).'),
    ).toEqual([
      { value: 1500, currency: 'MYR', percent: false },
      { value: 6.5, currency: 'SGD', percent: false },
      { value: 12, currency: 'MYR', percent: false },
      { value: 31.1, currency: null, percent: true },
    ]);
  });

  it('reads amounts between 1900 and 2099 as money, not years', () => {
    expect(citedNumbers('In 2026 you kept 2031.6 MYR and RM 2,045.')).toEqual([
      { value: 2031.6, currency: 'MYR', percent: false },
      { value: 2045, currency: 'MYR', percent: false },
    ]);
  });

  it.each([
    ['a sum across currencies', 'All in, you spent 2,201.80 across MYR and SGD.', 'cross_currency'],
    ['a currency-tagged cross sum', 'You spent MYR 1,891.30 this month.', 'cross_currency'],
    ['an invented amount', 'You spent RM 2,500 on food.', 'ungrounded'],
    ['a month-end projection', 'At this pace you will spend RM 4,838.07 this month.', 'ungrounded'],
    ['an amount under the wrong currency', 'You spent SGD 1,872.80 this month.', 'ungrounded'],
    [
      'the old rent-day-one projection',
      "At this pace you're up +1450% on September.",
      'ungrounded',
    ],
  ])('flags %s', (_, reply, kind) => {
    const issues = checkGrounding(reply, snapshot);
    expect(issues.map((i) => i.kind)).toContain(kind);
  });

  it('accepts rounding and same-currency differences', () => {
    expect(checkGrounding('About MYR 1,873 so far, MYR 67 more than September.', snapshot)).toEqual(
      [],
    );
  });

  it('fails a reply that skips the pinned facts or answers without the data', () => {
    expect(scoreReply(benchCase('sgd-forecast'), snapshot, 'Yes, your SGD will last.')).toEqual([
      'answered without the data',
    ]);
    expect(
      scoreReply(
        benchCase('afford'),
        buildBenchSnapshot('default', 'Can I afford RM800?'),
        'Yes, RM800 is fine.',
      ),
    ).toEqual(['missing MYR facts.forecast.afford.worstCaseAfter']);
    expect(scoreReply(benchCase('grocery-budget'), snapshot, 'Groceries look fine.')).toEqual([
      'missing MYR budgetCoach.categories.1.spentTotal',
      'missing MYR budgetCoach.categories.1.pctOfBudget',
    ]);
  });

  it('accepts numbers the user asked about', () => {
    expect(
      checkGrounding('RM800 is more than I can judge.', snapshot, 'Can I afford RM800?'),
    ).toEqual([]);
  });
});
