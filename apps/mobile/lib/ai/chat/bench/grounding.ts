/**
 * Offline grounding check for chat replies: every number must come from the snapshot (or the
 * user's question) under the currency it is cited in, and no number may be a cross-currency sum.
 * Percentages must be snapshot values as they stand, never derived.
 */
import type { FinanceAssistantToolSnapshot } from '@/lib/ai/snapshot/finance-metrics';

export type GroundingIssue = {
  value: number;
  currency: string | null;
  kind: 'ungrounded' | 'cross_currency';
};

const CURRENCY_ALIASES: Record<string, string> = {
  rm: 'MYR',
  myr: 'MYR',
  ringgit: 'MYR',
  s$: 'SGD',
  sgd: 'SGD',
  us$: 'USD',
  usd: 'USD',
  $: 'USD',
};

const CURRENCY_TOKEN = String.raw`RM|MYR|ringgit|S\$|SGD|US\$|USD|\$`;
const NUMBER = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`;
const MENTION = new RegExp(
  String.raw`(?:(?<![a-z])(${CURRENCY_TOKEN})\s?)?(${NUMBER})(\s?%)?(?:\s?(${CURRENCY_TOKEN})\b)?`,
  'gi',
);

const MONTHS =
  'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const DATE_LIKE = new RegExp(
  [
    String.raw`\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?`,
    String.raw`\b\d{1,2}:\d{2}\b`,
    String.raw`\b\d{1,2}(?:st|nd|rd|th)\b`,
    String.raw`\b(?:${MONTHS})\s+\d{1,2}\b`,
    String.raw`\b\d{1,2}\s+(?:${MONTHS})\b`,
    String.raw`\b(?:19|20)\d{2}\b`,
  ].join('|'),
  'gi',
);

function numericLeaves(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number' && Number.isFinite(value)) out.push(Math.abs(value));
  else if (Array.isArray(value)) value.forEach((v) => numericLeaves(v, out));
  else if (value && typeof value === 'object')
    Object.values(value).forEach((v) => numericLeaves(v, out));
  return out;
}

export function matches(cited: number, source: number): boolean {
  return (
    Math.abs(cited - source) <= 0.01 ||
    cited === Math.round(source) ||
    cited === Math.round(source * 10) / 10
  );
}

/** Snapshot values plus sums and differences of two values in the same currency. */
function derivable(leaves: number[]): number[] {
  const out = [...leaves];
  for (let i = 0; i < leaves.length; i += 1) {
    for (let j = i + 1; j < leaves.length; j += 1) {
      out.push(leaves[i] + leaves[j], Math.abs(leaves[i] - leaves[j]));
    }
  }
  return out;
}

export type CitedNumber = { value: number; currency: string | null; percent: boolean };

export function citedNumbers(reply: string): CitedNumber[] {
  const text = reply.replace(DATE_LIKE, ' ');
  return [...text.matchAll(MENTION)].map((m) => {
    const token = (m[1] ?? m[4])?.toLowerCase();
    return {
      value: Number(m[2].replace(/,/g, '')),
      currency: token ? CURRENCY_ALIASES[token] : null,
      percent: Boolean(m[3]),
    };
  });
}

export function checkGrounding(
  reply: string,
  snapshot: FinanceAssistantToolSnapshot,
  question = '',
): GroundingIssue[] {
  const leaves = Object.fromEntries(
    Object.entries(snapshot.currencies).map(([code, s]) => [code, numericLeaves(s)]),
  );
  const allowed = Object.fromEntries(
    Object.entries(leaves).map(([code, values]) => [code, derivable(values)]),
  );
  const fromQuestion = citedNumbers(question).map((n) => n.value);
  const codes = Object.keys(leaves);

  const crossSum = (value: number) =>
    codes.some((a) =>
      codes.some(
        (b) =>
          a < b &&
          leaves[a].some((x) => x > 0 && leaves[b].some((y) => y > 0 && matches(value, x + y))),
      ),
    );

  const issues: GroundingIssue[] = [];
  for (const { value, currency, percent } of citedNumbers(reply)) {
    if (fromQuestion.includes(value)) continue;
    const scopes = currency ? [currency] : codes;
    const pool = percent ? leaves : allowed;
    if (scopes.some((code) => (pool[code] ?? []).some((v) => matches(value, v)))) continue;
    issues.push({ value, currency, kind: crossSum(value) ? 'cross_currency' : 'ungrounded' });
  }
  return issues;
}
