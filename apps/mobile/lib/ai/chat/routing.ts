export type RouteIntent = 'extract' | 'analyze' | 'ambiguous';

const ANALYSIS_START =
  /^(how|what|why|when|where|am i|did i|should i|can i|is my|are my|analyze|review|compare|trend|budget|spending|over budget|under budget)\b/i;

const TRANSACTION_SIGNAL =
  /\$\s*\d|(?:^|\s)\d+(?:\.\d{1,2})?\s*(?:rm|usd|myr|sgd|eur|gbp)\b|\b(paid|bought|spent at|transfer to|transfer from|deposit|withdraw|top up|top-up)\b/i;

/**
 * Heuristic intent routing — images always extract; no LLM call.
 */
export function classifyTextIntent(text: string, hasImage: boolean): RouteIntent {
  const trimmed = text.trim();
  if (hasImage) return 'extract';
  if (!trimmed) return 'ambiguous';

  const hasQuestion = trimmed.includes('?') || ANALYSIS_START.test(trimmed);
  const hasTransactionSignal = TRANSACTION_SIGNAL.test(trimmed);

  if (hasQuestion && !hasTransactionSignal) return 'analyze';
  if (hasTransactionSignal && !hasQuestion) return 'extract';
  if (hasQuestion && hasTransactionSignal) return 'ambiguous';

  return 'extract';
}

export type ForcedIntent = 'extract' | 'analyze';

export function resolveRoute(text: string, hasImage: boolean, forced?: ForcedIntent): RouteIntent {
  if (forced === 'extract') return 'extract';
  if (forced === 'analyze') return 'analyze';
  return classifyTextIntent(text, hasImage);
}
