/**
 * Fixed AI answers for the Moni E2E build, so Maestro flows that say, scan, or chat get the
 * same result on every run without the Go backend. `mock.ts` consults them only when
 * `isE2eBuild()` is true; any other input keeps the mock's `unavailable` result.
 */
import type {
  ChatAnalyzeRequest,
  ChatAnalyzeResult,
  ExtractedTransaction,
  ExtractImageRequest,
  ExtractNotificationRequest,
  ExtractResult,
  ExtractTextRequest,
} from './types';

const FIXTURE_MODEL = 'e2e-fixture';

function extraction(
  fields: Partial<ExtractedTransaction> & Pick<ExtractedTransaction, 'amount' | 'merchant'>,
): ExtractedTransaction {
  return {
    type: 'expense',
    currency: 'MYR',
    description: null,
    walletHint: null,
    categoryHint: null,
    walletId: null,
    transferToWalletHint: null,
    transferToWalletId: null,
    confidence: 0.9,
    reasoning: 'E2E fixture.',
    occurredAt: null,
    ...fields,
  };
}

export const TEXT_FIXTURES: { said: string[]; extraction: ExtractedTransaction }[] = [
  {
    said: [
      'paid 6 ringgit parking at klcc',
      'paid six ringgit parking at klcc',
      'paid rm6 parking at klcc',
    ],
    extraction: extraction({
      amount: 6,
      merchant: 'Parking KLCC',
      categoryHint: 'Transport',
      confidence: 0.71,
      reasoning: 'You said parking at KLCC.',
    }),
  },
];

/**
 * Every scanned image reads as `.maestro/fixtures/receipt-mamak.png`. The scanner re-encodes
 * what it captures, so no byte hash survives from the fixture file to the request.
 */
export const IMAGE_FIXTURE = extraction({
  amount: 15.3,
  merchant: 'Restoran Nasi Kandar Ali',
  categoryHint: 'Food & Dining',
  walletHint: 'Cash',
  confidence: 0.92,
  reasoning: 'TOTAL RM 15.30, paid in cash.',
});

const MAYBANK_ALERT = /You've spent RM([\d,]+\.\d{2}) at (.+?) on \d{2}\/\d{2}/;
const ALERT_CATEGORIES: Record<string, string> = {
  'GRAB*FOOD': 'Food & Dining',
  'JAYA GROCER': 'Groceries',
};

export const CHAT_FIXTURES: { asked: RegExp; reply: string }[] = [
  {
    asked: /^how much (?:on|for) transport this month$/,
    reply: 'Most of your Transport this month went on Grab rides and petrol.',
  },
];

export function normalizeSaid(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.!?,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function textFixture(req: ExtractTextRequest): ExtractResult | null {
  const said = normalizeSaid(req.text);
  const hit = TEXT_FIXTURES.find((fixture) => fixture.said.includes(said));
  return hit ? { status: 'ok', extraction: hit.extraction } : null;
}

export function imageFixture(_req: ExtractImageRequest): ExtractResult {
  return { status: 'ok', extraction: IMAGE_FIXTURE };
}

export function notificationFixture(req: ExtractNotificationRequest): ExtractResult | null {
  const { title, text, bigText } = req.notification;
  const match = MAYBANK_ALERT.exec([title, bigText ?? text].join(' '));
  if (!match) return null;
  const merchant = match[2];
  return {
    status: 'ok',
    extraction: extraction({
      amount: Number(match[1].replace(/,/g, '')),
      merchant,
      categoryHint: ALERT_CATEGORIES[merchant] ?? null,
      walletId: req.lockedWalletId ?? null,
      reasoning: `Maybank alert for ${merchant}.`,
    }),
  };
}

export function chatFixture(req: ChatAnalyzeRequest): ChatAnalyzeResult | null {
  const asked = normalizeSaid(req.message);
  const hit = CHAT_FIXTURES.find((fixture) => fixture.asked.test(asked));
  return hit ? { status: 'ok', reply: hit.reply, modelId: FIXTURE_MODEL } : null;
}
