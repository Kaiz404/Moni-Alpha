import { classifyTextIntent, resolveRoute, type RouteIntent } from '@/lib/ai/chat/routing';

const cases: [string, RouteIntent][] = [
  // Logging a transaction
  ['lunch 12', 'extract'],
  ['grab 15', 'extract'],
  ['nasi lemak 8.50', 'extract'],
  ['RM12 nasi lemak', 'extract'],
  ['RM 12 teh tarik', 'extract'],
  ['rm45.90 shopee', 'extract'],
  ['spent RM 30 on petrol', 'extract'],
  ['MYR 120 groceries at Jaya Grocer', 'extract'],
  ['12 rm coffee', 'extract'],
  ['25 myr parking', 'extract'],
  ['$15 netflix', 'extract'],
  ['USD 9.99 icloud', 'extract'],
  ['SGD 6 kopi at changi', 'extract'],
  ['paid TNB bill 145', 'extract'],
  ['bought shoes 299', 'extract'],
  ['spent at mamak 18', 'extract'],
  ['transfer to savings 500', 'extract'],
  ['transfer from Maybank to TNG 50', 'extract'],
  ['deposit 200 cash to bank', 'extract'],
  ['withdraw 100 from ATM', 'extract'],
  ['top up TNG 30', 'extract'],
  ['top-up touch n go RM50', 'extract'],
  ['salary 4500 received', 'extract'],
  ['got paid 3000 today', 'extract'],
  ['paid netflix subscription RM55', 'extract'],
  ['I owe Ali RM50 for dinner', 'extract'],
  ['yesterday grab RM15', 'extract'],
  ['dinner with friends 86', 'extract'],
  ['parking', 'extract'],
  ['Lost 200 at the casino, how bad is my month', 'extract'],

  // Asking about finances
  ['Can I afford RM800?', 'analyze'],
  ['can i afford rm 2400 for a new phone', 'analyze'],
  ['Could I afford a RM1500 holiday next month?', 'analyze'],
  ['how much did I spend on food this month?', 'analyze'],
  ['How much did I spend this week', 'analyze'],
  ['what did I spend the most on?', 'analyze'],
  ['what are my top merchants', 'analyze'],
  ['why is my spending so high', 'analyze'],
  ['where did my money go', 'analyze'],
  ['when did I last pay rent', 'analyze'],
  ['which category is over budget', 'analyze'],
  ['who do I owe money to', 'analyze'],
  ['am I over budget on groceries', 'analyze'],
  ['did I spend more than last month', 'analyze'],
  ['do I have any subscriptions', 'analyze'],
  ['have I spent more on grab than usual', 'analyze'],
  ['should I cut back on eating out', 'analyze'],
  ['is my spending on track', 'analyze'],
  ['are my budgets ok', 'analyze'],
  ['is there anything unusual this month', 'analyze'],
  ['will I make it to payday', 'analyze'],
  ['Will I run out of money before the end of the month', 'analyze'],
  ['show my subscriptions', 'analyze'],
  ['show me spending by category', 'analyze'],
  ['list my biggest expenses', 'analyze'],
  ['tell me where my money goes', 'analyze'],
  ['summarise my month', 'analyze'],
  ['summarize last month', 'analyze'],
  ['explain my food budget', 'analyze'],
  ['analyze my spending', 'analyze'],
  ['review my budget', 'analyze'],
  ['compare this month with last month', 'analyze'],
  ['trend of my grocery spending', 'analyze'],
  ['budget status', 'analyze'],
  ['spending this month', 'analyze'],
  ['forecast my spending', 'analyze'],
  ['my subscriptions', 'analyze'],
  ['payday is when?', 'analyze'],
  ['how much do I owe', 'analyze'],
  ['how much is left to spend on food', 'analyze'],

  // Both readings are plausible: ask
  ['Did I pay RM45 to TNB?', 'ambiguous'],
  ['spent RM30 on lunch, how much is left?', 'ambiguous'],
  ['how much was the 12 rm coffee?', 'ambiguous'],
];

describe('chat routing', () => {
  it.each(cases)('%s -> %s', (text, expected) => {
    expect(classifyTextIntent(text, false)).toBe(expected);
  });

  it('covers at least 60 phrasings', () => {
    expect(cases.length).toBeGreaterThanOrEqual(60);
  });

  it('always extracts photos and honours forced intents', () => {
    expect(classifyTextIntent('Can I afford RM800?', true)).toBe('extract');
    expect(resolveRoute('lunch 12', false, 'analyze')).toBe('analyze');
    expect(resolveRoute('how much on food?', false, 'extract')).toBe('extract');
    expect(classifyTextIntent('   ', false)).toBe('ambiguous');
  });
});
