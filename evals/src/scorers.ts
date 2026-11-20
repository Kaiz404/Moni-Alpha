import type { Evaluation } from '@langfuse/client';
import { checkGrounding, citedNumbers, matches } from '../../apps/mobile/lib/ai/chat/bench/grounding.ts';
import type { ChatExpected, ExtractionExpected } from './suites.ts';

type Extraction = {
  amount: number;
  type: string;
  currency: string;
  merchant: string | null;
  walletId: string | null;
  transferToWalletId: string | null;
  occurredAt: string | null;
  itemCount?: number;
};
export type ExtractResponse = { status: string; extraction?: Extraction; reason?: string };
export type ChatResponse = { status: string; reply?: string; reason?: string };

const COMPANY_WORDS =
  /\b(sdn|bhd|berhad|inc|llc|ltd|limited|plc|pte|pty|co|corp|corporation|company|enterprise|trading|store|stores|restaurant)\b/g;

function merchantTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(COMPANY_WORDS, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/** Same merchant when one name's words contain the other's, or most words are shared. */
export function sameMerchant(got: string | null | undefined, want: string): boolean {
  if (!got) return false;
  const a = merchantTokens(got);
  const b = merchantTokens(want);
  if (a.length === 0 || b.length === 0) return false;
  const joinedA = a.join('');
  const joinedB = b.join('');
  if (joinedA.includes(joinedB) || joinedB.includes(joinedA)) return true;
  const shared = a.filter((t) => b.includes(t)).length;
  return shared / Math.min(a.length, b.length) >= 0.5;
}

const score = (name: string, ok: boolean, comment?: string): Evaluation => ({
  name,
  value: ok ? 1 : 0,
  dataType: 'BOOLEAN',
  comment,
});

/** One score per labelled field, plus `exact` when every labelled field is right. */
export function scoreExtraction(output: ExtractResponse, expected: ExtractionExpected): Evaluation[] {
  const scores: Evaluation[] = [
    score('status', output.status === expected.status, `got ${output.status}${output.reason ? `: ${output.reason}` : ''}`),
  ];
  if (expected.status === 'ok') {
    const ex = output.extraction;
    const field = (name: string, want: unknown, got: unknown, ok: boolean) =>
      scores.push(score(name, ok, `want ${JSON.stringify(want)}, got ${JSON.stringify(got ?? null)}`));
    if (expected.amount !== undefined)
      field('amount', expected.amount, ex?.amount, ex !== undefined && Math.abs(ex.amount - expected.amount) < 0.011);
    if (expected.currency !== undefined)
      field('currency', expected.currency, ex?.currency, ex?.currency === expected.currency);
    if (expected.type !== undefined) field('type', expected.type, ex?.type, ex?.type === expected.type);
    if (expected.merchant !== undefined)
      field('merchant', expected.merchant, ex?.merchant, sameMerchant(ex?.merchant, expected.merchant));
    if (expected.date !== undefined) field('date', expected.date, ex?.occurredAt, ex?.occurredAt === expected.date);
    if (expected.walletId !== undefined)
      field('wallet', expected.walletId, ex?.walletId, ex?.walletId === expected.walletId);
    if (expected.toWalletId !== undefined)
      field('to_wallet', expected.toWalletId, ex?.transferToWalletId, ex?.transferToWalletId === expected.toWalletId);
    if (expected.itemCount !== undefined)
      field('item_count', expected.itemCount, ex?.itemCount, ex?.itemCount === expected.itemCount);
  }
  const wrong = scores.filter((s) => s.value === 0).map((s) => s.name);
  scores.push(score('exact', wrong.length === 0, wrong.length ? `wrong: ${wrong.join(', ')}` : undefined));
  return scores;
}

const REFUSAL =
  /\b(can't|cannot|can not|don't have|don't see|doesn't|isn't|aren't|not able|unable|not available|no fair|no reliable|not tracked|no data|outside|only help|can only)\b/i;
const MAX_REPLY_WORDS = 90;
const INTERNAL_NAME =
  /\bnull\b|\bsnapshot\b|calendarMonth|rolling30|pendingProposals|dailyPace|endBalance|needsConfirm|fitsWorstCase|worstCaseAfter|likelyAfter|changeLast30Days/i;

type Snapshot = Parameters<typeof checkGrounding>[1];

function factValue(snapshot: Snapshot, currency: string, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], snapshot.currencies[currency]);
}

/** The chat bench's checks (apps/mobile/lib/ai/chat/bench/cases.ts), one score each. */
export function scoreChat(
  output: ChatResponse,
  expected: ChatExpected,
  input: { message: string; snapshot: Snapshot },
): Evaluation[] {
  const reply = output.reply ?? '';
  if (output.status !== 'ok' || reply === '') {
    return [score('answered', false, output.reason), score('pass', false, 'no reply')];
  }
  const ungrounded = checkGrounding(reply, input.snapshot, input.message);
  const cited = citedNumbers(reply);
  const missing = expected.facts
    .filter(({ value }) => value !== null && typeof value !== 'boolean')
    .filter(({ currency, path, value }) => {
      const want = factValue(input.snapshot, currency, path) ?? value;
      return typeof want === 'string'
        ? !reply.toLowerCase().includes(want.toLowerCase())
        : !cited.some((n) => (n.currency ?? currency) === currency && matches(n.value, Math.abs(Number(want))));
    })
    .map(({ currency, path }) => `${currency} ${path}`);
  const words = reply.trim().split(/\s+/).length;
  const scores = [
    score('answered', true),
    score('grounded', ungrounded.length === 0, ungrounded.map((i) => `${i.kind} ${i.value}`).join(', ') || undefined),
    score('facts_quoted', missing.length === 0, missing.length ? `missing ${missing.join(', ')}` : undefined),
    score('concise', words <= MAX_REPLY_WORDS, `${words} words`),
    score('no_internal_names', !INTERNAL_NAME.test(reply)),
  ];
  if (expected.refuse) scores.push(score('declined', REFUSAL.test(reply)));
  const failed = scores.filter((s) => s.value === 0).map((s) => s.name);
  scores.push(score('pass', failed.length === 0, failed.length ? `failed: ${failed.join(', ')}` : undefined));
  return scores;
}
