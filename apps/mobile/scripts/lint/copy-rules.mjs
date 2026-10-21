// Ported from the design canvas tool lint_terms.py, which follows the "Never use" table and the
// Formatting list in docs/redesign/glossary.md. Keep the two in step. lint_terms.py also has a
// greeting rule and a "time after now" rule; both test the canvas sample time of 2:06 pm, so they
// stay on the canvas side only.
export const RULES = [
  {
    term: 'Split',
    pattern: /\bSplit\b(?! a\b)/,
    reason: 'no Split feature',
  },
  {
    term: 'Tags',
    pattern: /\btags?\b/i,
    reason: 'no Tags feature; the slot shows Source',
  },
  {
    term: 'Duplicate',
    pattern:
      /(?<!\ba )(?<!\bmay )\bduplicat(e|es|ed|ing)\b(?! warning)/i,
    reason: 'no Duplicate action',
  },
  {
    term: 'Decline',
    pattern: /\bdeclin(e|es|ed|ing)\b/i,
    reason: 'use Not mine',
  },
  {
    term: 'Merge',
    pattern: /\bmerg(e|es|ed|ing)\b/i,
    reason: 'no Merge',
  },
  {
    term: 'Move money',
    pattern: /\bmove (money\b|RM|from\b)/i,
    reason: 'no move-money feature',
  },
  {
    term: 'Plan',
    pattern: /\bPlans?\b/,
    reason: 'the tab is Budget',
  },
  {
    term: 'Insights',
    pattern: /\bInsights?\b/,
    reason: 'the tab is Budget',
  },
  {
    term: 'daily budget',
    pattern: /\bdaily budgets?\b/i,
    reason: 'use even pace or safe to spend a day',
  },
  {
    term: 'target',
    pattern:
      /\b(under|over|above|below|daily|pace|spending|budget)\s+targets?\b|×\s?targets?\b|\btargets?\s+(RM|of RM|a day|pace)/i,
    reason: 'use even pace',
  },
  {
    term: 'Ask Moni tab',
    pattern: /\b(Ask )?Moni tab\b/i,
    reason: 'Moni chat is a page, not a tab',
  },
  {
    term: "Don't ask again",
    pattern: /\bdon['’]t ask again\b/i,
    reason: "use Don't ask about similar",
  },
  {
    term: 'Queued',
    pattern: /\bqueued\b/i,
    reason: 'the status is Waiting for review',
  },
  {
    term: 'hyphen before RM',
    pattern: /(?<![\w.])[-–]\s?(RM|\$)\d/,
    reason: 'minus is U+2212: −RM45.90',
  },
  {
    term: 'RM space',
    pattern: /RM[ \u00a0]+\d/,
    reason: 'no space: RM42',
  },
  { term: 'Sept', pattern: /\bSept\b/, reason: 'use Sep' },
  {
    term: 'month first',
    pattern:
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b(?!:)/,
    reason: 'day first: Wed 14 Oct',
  },
  {
    term: 'curly apostrophe',
    pattern: /Touch ’n Go/,
    reason: "straight apostrophe: Touch 'n Go",
  },
];

export function termsIn(text) {
  return RULES.filter(({ pattern }) => pattern.test(text)).map(
    ({ term, reason }) => ({
      term,
      reason,
    }),
  );
}
