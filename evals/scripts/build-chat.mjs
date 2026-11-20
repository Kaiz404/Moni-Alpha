// Builds evals/datasets/chat/items.jsonl from three sources:
//   - the mobile chat bench (cases.ts + fixture.ts), vendored in datasets/chat/sources/moni-bench.json
//   - handwritten multi-turn follow-ups over the bench's default snapshot
//   - CLINC150 out-of-scope and unsupported banking requests (CC BY 3.0)
//
//   node evals/scripts/build-chat.mjs            rebuild items.jsonl from the vendored export
//   node evals/scripts/build-chat.mjs --refresh  re-export the bench through Jest first, and check
//                                                the CLINC150 rows against upstream
//
// --refresh runs Jest in MONI_MOBILE_DIR (default: this checkout's apps/mobile), which needs
// node_modules there. It writes nothing under apps/.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const evalsDir = path.resolve(import.meta.dirname, '..');
const suiteDir = path.join(evalsDir, 'datasets/chat');
const benchPath = path.join(suiteDir, 'sources/moni-bench.json');
const refresh = process.argv.includes('--refresh');

const CLINC_URL = 'https://raw.githubusercontent.com/clinc/oos-eval/master/data/data_full.json';

// ---------------------------------------------------------------------------------------------
// Bench export

function exportBench() {
  const mobile = path.resolve(
    process.env.MONI_MOBILE_DIR ?? path.join(evalsDir, '..', 'apps/mobile'),
  );
  const core = path.resolve(mobile, '../../packages/core');
  const dir = mkdtempSync(path.join(tmpdir(), 'moni-chat-export-'));
  const out = path.join(dir, 'bench.json');
  writeFileSync(
    path.join(dir, 'export.test.js'),
    `const fs = require('node:fs');
const { benchSnapshot, CHAT_BENCH_CASES } = require('@/lib/ai/chat/bench/cases');
it('exports', () => {
  const cases = CHAT_BENCH_CASES.map((c) => ({
    id: c.id,
    fixture: c.fixture ?? 'default',
    question: c.question,
    facts: c.facts,
    refuse: c.refuse === true,
    snapshot: benchSnapshot(c),
  }));
  fs.writeFileSync(${JSON.stringify(out)}, JSON.stringify({ cases }, null, 1));
});
`,
  );
  // Map @repo/core straight to the workspace package so a stale node_modules link can't break it.
  writeFileSync(
    path.join(dir, 'jest.config.cjs'),
    `const base = require(${JSON.stringify(path.join(mobile, 'jest.config.js'))});
const core = ${JSON.stringify(core)};
const map = {};
for (const [k, v] of Object.entries(require(core + '/package.json').exports)) {
  const sub = k === '.' ? '' : k.slice(1);
  map['^@repo/core' + sub.replace(/[/-]/g, (c) => '\\\\' + c) + '$'] = core + v.slice(1);
}
module.exports = {
  ...base,
  rootDir: ${JSON.stringify(mobile)},
  roots: [${JSON.stringify(dir)}],
  testMatch: ['**/export.test.js'],
  moduleNameMapper: { ...map, ...base.moduleNameMapper },
};
`,
  );
  execFileSync(
    'npx',
    ['jest', '--config', path.join(dir, 'jest.config.cjs'), '--runInBand'],
    { cwd: mobile, stdio: 'inherit' },
  );
  const exported = readFileSync(out, 'utf8');
  rmSync(dir, { recursive: true, force: true });
  writeFileSync(benchPath, exported + '\n');
}

if (refresh) exportBench();
const bench = JSON.parse(readFileSync(benchPath, 'utf8')).cases;
const byId = Object.fromEntries(bench.map((c) => [c.id, c]));

function valueAt(snapshot, { currency, path: p }) {
  return p
    .split('.')
    .reduce((node, key) => (node == null ? undefined : node[key]), snapshot.currencies[currency]);
}

function assertFacts(id, snapshot, facts) {
  for (const fact of facts) {
    const actual = valueAt(snapshot, fact);
    if (actual !== fact.value) {
      throw new Error(
        `${id}: ${fact.currency} ${fact.path} is ${JSON.stringify(actual)} in the snapshot, pinned ${JSON.stringify(fact.value)}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------------------------
// 1. Bench cases

const TOPIC_TAGS = [
  [/afford/, 'afford'],
  [/payday|forecast|month-end|bills/, 'forecast'],
  [/budget|grocery-left/, 'budget'],
  [/sgd|usd|currenc/, 'multi-currency'],
];

function benchTags(c) {
  const tags = new Set();
  if (c.refuse) tags.add('refuse');
  if (c.fixture !== 'default') tags.add(`fixture-${c.fixture}`);
  for (const [re, tag] of TOPIC_TAGS) if (re.test(c.id)) tags.add(tag);
  if (new Set(c.facts.map((f) => f.currency)).size > 1) tags.add('multi-currency');
  return [...tags].sort();
}

const items = bench.map((c) => {
  assertFacts(c.id, c.snapshot, c.facts);
  return {
    id: `bench-${c.id}`,
    input: { message: c.question, snapshot: c.snapshot },
    expected: { facts: c.facts, refuse: c.refuse },
    metadata: {
      source: 'moni-bench',
      licence: 'own',
      trainable: true,
      synthetic: true,
      region: 'MY',
      tags: benchTags(c),
    },
  };
});

// ---------------------------------------------------------------------------------------------
// 2. Multi-turn follow-ups. Each uses the snapshot the app would send for the follow-up message:
// the default fixture, or the afford snapshot when the follow-up itself names an amount (the app
// parses the asked amount from the current message only).

const MYR = 'MYR';
const SGD = 'SGD';
const user = (content) => ({ role: 'user', content });
const assistant = (content) => ({ role: 'assistant', content });
const DEFAULT_SNAPSHOT = 'previous-month';

const MULTI_TURN = [
  {
    id: 'last-month',
    history: [
      user('How much have I spent this month?'),
      assistant('So far in October you have spent RM 1,872.80, and SGD 18.50 separately.'),
    ],
    message: 'and last month?',
    facts: [{ currency: MYR, path: 'calendarMonth.expensePreviousCalendarMonth', value: 1805.6 }],
  },
  {
    id: 'sgd-last-month',
    history: [
      user('How much did I spend in Singapore dollars?'),
      assistant('In the last 30 days you spent SGD 78.40.'),
    ],
    message: 'and last month?',
    facts: [{ currency: SGD, path: 'calendarMonth.expensePreviousCalendarMonth', value: 59.9 }],
    tags: ['multi-currency'],
  },
  {
    id: 'groceries-budget',
    history: [
      user('Where did my money go?'),
      assistant(
        'Over the last 30 days Housing took RM 1,500 and Groceries RM 397, out of RM 2,123.40 spent.',
      ),
      user('Am I over budget on food?'),
      assistant('No. Your food budget is 6% used, RM 18 of RM 300.'),
    ],
    message: 'what about groceries?',
    facts: [
      { currency: MYR, path: 'budgetCoach.categories.1.spentTotal', value: 186.4 },
      { currency: MYR, path: 'budgetCoach.categories.1.pctOfBudget', value: 31.1 },
    ],
    tags: ['budget'],
  },
  {
    id: 'afford-after-payday-check',
    snapshot: 'afford',
    history: [
      user('Will I make it to payday?'),
      assistant(
        'Yes. Before your salary on 25 October you should have between RM 8,352.96 and RM 8,751.50 in your cash and bank accounts.',
      ),
    ],
    message: 'so can I afford RM800?',
    facts: [
      { currency: MYR, path: 'facts.forecast.afford.worstCaseAfter', value: 7552.96 },
      { currency: MYR, path: 'facts.forecast.afford.fitsWorstCase', value: true },
    ],
    tags: ['afford', 'forecast'],
  },
  {
    id: 'afford-it-no-amount',
    history: [
      user('I want to buy a new phone for RM800.'),
      assistant(
        'Got it. You have RM 8,751.50 in cash and bank accounts, and your salary of RM 4,500 looks due on 25 October.',
      ),
    ],
    message: 'so can I afford it?',
    facts: [{ currency: MYR, path: 'facts.forecast.endBalance.low', value: 8352.96 }],
    tags: ['afford', 'forecast'],
  },
  {
    id: 'afford-bigger-amount',
    snapshot: 'afford-too-much',
    history: [
      user('Can I afford RM800?'),
      assistant(
        'Yes. Even if your spending runs high, you would still have about RM 7,552.96 left before your salary on 25 October.',
      ),
    ],
    message: 'and what about RM9000?',
    facts: [
      { currency: MYR, path: 'facts.forecast.startBalance', value: 8751.5 },
      { currency: MYR, path: 'facts.forecast.afford.fitsWorstCase', value: false },
      { currency: MYR, path: 'facts.forecast.afford.worstCaseAfter', value: -647.04 },
    ],
    tags: ['afford', 'forecast'],
  },
  {
    id: 'apart-from-rent',
    history: [
      user('What was my biggest expense?'),
      assistant('Your biggest expense was RM 1,500 to Landlord for Housing on 1 October.'),
    ],
    message: 'and apart from rent, where do I spend the most?',
    facts: [
      { currency: MYR, path: 'rolling30.topMerchants.1.name', value: 'Jaya Grocer' },
      { currency: MYR, path: 'rolling30.topMerchants.1.amount', value: 397 },
    ],
  },
  {
    id: 'pace-vs-before',
    history: [
      user('What is my daily average spend?'),
      assistant('Your daily average over the last 30 days is RM 70.78.'),
    ],
    message: 'is that more than before?',
    facts: [{ currency: MYR, path: 'rolling30.deltas.expensePctVsPrior', value: 36.6 }],
  },
  {
    id: 'income-kept',
    history: [
      user('How much came in over the last month?'),
      assistant('MYR 4,589.90 came in over the last 30 days.'),
    ],
    message: 'and how much of it did I keep?',
    facts: [
      { currency: MYR, path: 'rolling30.current.net', value: 2466.5 },
      { currency: MYR, path: 'rolling30.rates.savingsMargin', value: 53.7 },
    ],
  },
  {
    id: 'combine-currencies',
    history: [
      user('How much have I spent this month?'),
      assistant('So far in October you have spent RM 1,872.80, and SGD 18.50 separately.'),
      user('Why are they separate?'),
      assistant('I keep each currency apart and do not convert between them.'),
    ],
    message: 'just add them up into one number for me',
    facts: [],
    refuse: true,
    tags: ['multi-currency', 'refuse'],
  },
];

for (const t of MULTI_TURN) {
  const { snapshot } = byId[t.snapshot ?? DEFAULT_SNAPSHOT];
  assertFacts(`multi-turn-${t.id}`, snapshot, t.facts);
  items.push({
    id: `multi-turn-${t.id}`,
    input: { message: t.message, snapshot, history: t.history },
    expected: { facts: t.facts, refuse: t.refuse === true },
    metadata: {
      source: 'moni-handwritten',
      licence: 'own',
      trainable: true,
      synthetic: true,
      region: 'MY',
      tags: ['multi-turn', ...(t.tags ?? [])].sort(),
    },
  });
}

// ---------------------------------------------------------------------------------------------
// 3. CLINC150 (Larson et al. 2019, github.com/clinc/oos-eval, CC BY 3.0). Rows picked by hand:
// oos_test queries that are plainly not about the user's money, and in-scope banking intents
// from `test` that ask Moni to act on a bank account, which it cannot do.

const CLINC = [
  ['oos_test', 1, 'how many prime numbers are there between 0 and 100', 'general'],
  ['oos_test', 6, 'what veggies can i pair with mushrooms', 'general'],
  ['oos_test', 10, 'how do i get red wine out of a couch cushion', 'general'],
  ['oos_test', 12, 'who invented the internet', 'general'],
  ['oos_test', 16, 'is the earth flat', 'general'],
  ['oos_test', 30, 'what is the population of south africa', 'general'],
  ['oos_test', 33, 'how to remove a stripped bolt', 'general'],
  ['oos_test', 59, 'can you tell me how to clean a fish tank', 'general'],
  ['oos_test', 91, 'when is the next full moon', 'general'],
  ['oos_test', 93, 'why is the sky blue', 'general'],
  ['oos_test', 245, 'what is the official language of romania', 'general'],
  ['test', 810, 'can you freeze my bank account', 'banking-action'],
  ['test', 3090, 'i want to report fraudulent activity on my navy federal card', 'banking-action'],
  ['test', 1112, 'help me get my gas bill paid', 'banking-action'],
  ['test', 2101, 'i lost my card, what do i do next', 'banking-action'],
];

if (refresh) {
  const upstream = await (await fetch(CLINC_URL)).json();
  for (const [split, index, text] of CLINC) {
    if (upstream[split][index]?.[0] !== text) {
      throw new Error(`CLINC150 ${split}[${index}] is ${JSON.stringify(upstream[split][index])}`);
    }
  }
}

for (const [split, index, text, kind] of CLINC) {
  items.push({
    id: `oos-clinc150-${split.replace('_', '-')}-${String(index).padStart(4, '0')}`,
    input: { message: text, snapshot: byId[DEFAULT_SNAPSHOT].snapshot },
    expected: { facts: [], refuse: true },
    metadata: {
      source: 'clinc150',
      licence: 'CC-BY-3.0',
      trainable: true,
      synthetic: false,
      region: 'US',
      tags: ['out-of-scope', kind],
    },
  });
}

// ---------------------------------------------------------------------------------------------

const ids = new Set(items.map((i) => i.id));
if (ids.size !== items.length) throw new Error('duplicate item ids');
items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
writeFileSync(
  path.join(suiteDir, 'items.jsonl'),
  items.map((i) => JSON.stringify(i)).join('\n') + '\n',
);
const counts = {};
for (const i of items) counts[i.metadata.source] = (counts[i.metadata.source] ?? 0) + 1;
console.log(`chat: ${items.length} items`, counts);
