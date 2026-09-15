export type RouteIntent = 'extract' | 'analyze' | 'ambiguous';

const ANALYSIS_START =
  /^(how|what|why|when|where|which|who|am i|did i|do i|have i|should i|can i|could i|is my|are my|is there|are there|will|would|show|list|tell me|summari[sz]e|explain|analy[sz]e|review|compare|trend|budget|spending|over budget|under budget|forecast)\b/i;

/** Topics that only make sense as questions, even when the message also names an amount. */
const ANALYSIS_TOPIC =
  /\b(afford|forecast|payday|pay day|subscriptions?|owe|owing|on track|run out|left to spend|overspen(d|t|ding))\b/i;

const CURRENCY = '(?:rm|usd|myr|sgd|eur|gbp)';

const TRANSACTION_SIGNAL = new RegExp(
  String.raw`\$\s*\d|\b${CURRENCY}\s?\d|(?:^|\s)\d+(?:\.\d{1,2})?\s*${CURRENCY}\b|\b(paid|bought|spent at|transfer to|transfer from|deposit|withdraw|top up|top-up)\b`,
  'i',
);

/**
 * Heuristic intent routing — images always extract; no LLM call.
 */
export function classifyTextIntent(text: string, hasImage: boolean): RouteIntent {
  const trimmed = text.trim();
  if (hasImage) return 'extract';
  if (!trimmed) return 'ambiguous';

  const asks = trimmed.includes('?') || ANALYSIS_START.test(trimmed);
  const topic = ANALYSIS_TOPIC.test(trimmed);
  const hasTransactionSignal = TRANSACTION_SIGNAL.test(trimmed);

  if (asks && (topic || !hasTransactionSignal)) return 'analyze';
  if (hasTransactionSignal) return asks ? 'ambiguous' : 'extract';
  if (topic) return 'analyze';

  return 'extract';
}

export type ForcedIntent = 'extract' | 'analyze';

export function resolveRoute(text: string, hasImage: boolean, forced?: ForcedIntent): RouteIntent {
  if (forced === 'extract') return 'extract';
  if (forced === 'analyze') return 'analyze';
  return classifyTextIntent(text, hasImage);
}
