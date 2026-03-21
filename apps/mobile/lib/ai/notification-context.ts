export type RawNotificationForContext = {
  id: string;
  app: string;
  title: string;
  titleBig?: string;
  text: string;
  bigText?: string;
  subText?: string;
  summaryText?: string;
  extraInfoText?: string;
  time: string;
  receivedAt: string;
};

const MONEY_PATTERN =
  /\b(?:USD|EUR|GBP|NGN|ZAR|KES|GHS|UGX|TZS|MYR|SGD|AUD|CAD|CHF|JPY|CNY|INR|BRL|MXN|AED|SAR|QAR|KWD|OMR|BHD|RM|Rs|IDR|PHP|THB)\s*[\d,]+(?:[.,]\d{1,2})?\b|(?:[$€£¥₦₹₩₪₱฿₫₲₴₵₸₽₾])\s*[\d,]+(?:[.,]\d{1,2})?|\b[\d,]+(?:[.,]\d{1,2})?\s*(?:USD|EUR|GBP|NGN|ZAR|KES|GHS|UGX|TZS|MYR|SGD|AUD|CAD|CHF|JPY|CNY|INR|BRL|MXN|AED|SAR|QAR|KWD|OMR|BHD|RM|Rs|IDR|PHP|THB)\b/i;

const TRANSFER_SIGNAL_PATTERN =
  /\b(credited|debited|received|sent|paid|payment|purchase|spent|withdrawn|withdrawal|deposit|transferred|transfer|refund|dr\b|cr\b|from\s+|to\s+|at\s+|via\s+|merchant|beneficiary|sender|receiver)\b/i;

const INCOME_SIGNAL_PATTERN =
  /\b(credited|credit|received|receive|incoming|deposit|refund|cashback|reversal)\b/i;

const EXPENSE_SIGNAL_PATTERN =
  /\b(debited|debit|sent|send|paid|payment|purchase|spent|withdrawn|withdrawal|transfer to)\b/i;

const COUNTERPARTY_BOUNDARY =
  '(?=\\.|,|;|:|\\b(?:tap|ref|reference|mobile\\s+number|acct|account|bal|balance|via|for)\\b|$)';

const COUNTERPARTY_FROM_PATTERN = new RegExp(
  `\\b(?:from|sender|received from)\\s+([a-z0-9 .,'&-]{2,60}?)${COUNTERPARTY_BOUNDARY}`,
  'i',
);

const COUNTERPARTY_TO_PATTERN = new RegExp(
  `\\b(?:to|recipient|beneficiary|paid to|transfer to)\\s+([a-z0-9 .,'&-]{2,60}?)${COUNTERPARTY_BOUNDARY}`,
  'i',
);

type DirectionHint = 'income' | 'expense' | 'transfer' | 'unknown';

export type NotificationLlmContext = {
  app: string;
  title: string;
  body: string;
  receivedAt: string;
  amountHint: string | null;
  directionHint: DirectionHint;
  counterpartyHint: string | null;
  signals: {
    hasMoney: boolean;
    hasTransferSignal: boolean;
  };
  raw: {
    text: string;
    bigText: string;
    subText: string;
    summaryText: string;
    extraInfoText: string;
  };
};

function normalizeText(value: unknown): string {
  if (!value) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function notificationText(notification: RawNotificationForContext): string {
  return [
    notification.title,
    notification.titleBig,
    notification.text,
    notification.bigText,
    notification.subText,
    notification.summaryText,
    notification.extraInfoText,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(' ');
}

function extractAmountHint(text: string): string | null {
  const match = text.match(MONEY_PATTERN);
  if (!match) return null;
  return normalizeText(match[0]);
}

function inferDirection(text: string): DirectionHint {
  if (INCOME_SIGNAL_PATTERN.test(text) && !EXPENSE_SIGNAL_PATTERN.test(text)) return 'income';
  if (EXPENSE_SIGNAL_PATTERN.test(text) && !INCOME_SIGNAL_PATTERN.test(text)) return 'expense';
  if (/\btransfer\b/i.test(text)) return 'transfer';
  return 'unknown';
}

function extractCounterpartyHint(text: string): string | null {
  const fromMatch = text.match(COUNTERPARTY_FROM_PATTERN);
  if (fromMatch?.[1]) return normalizeText(fromMatch[1]).replace(/[.,;:]+$/, '');

  const toMatch = text.match(COUNTERPARTY_TO_PATTERN);
  if (toMatch?.[1]) return normalizeText(toMatch[1]).replace(/[.,;:]+$/, '');

  return null;
}

export function buildNotificationContext(notification: RawNotificationForContext): NotificationLlmContext {
  const title = normalizeText(notification.titleBig || notification.title || '');
  const body = normalizeText(
    notification.bigText ||
      notification.text ||
      notification.subText ||
      notification.summaryText ||
      notification.extraInfoText ||
      '',
  );
  const merged = notificationText(notification);

  return {
    app: normalizeText(notification.app || 'unknown'),
    title,
    body,
    receivedAt: normalizeText(notification.receivedAt || notification.time || ''),
    amountHint: extractAmountHint(merged),
    directionHint: inferDirection(merged),
    counterpartyHint: extractCounterpartyHint(merged),
    signals: {
      hasMoney: MONEY_PATTERN.test(merged),
      hasTransferSignal: TRANSFER_SIGNAL_PATTERN.test(merged),
    },
    raw: {
      text: normalizeText(notification.text),
      bigText: normalizeText(notification.bigText),
      subText: normalizeText(notification.subText),
      summaryText: normalizeText(notification.summaryText),
      extraInfoText: normalizeText(notification.extraInfoText),
    },
  };
}

export function formatNotificationContextForLlm(notification: RawNotificationForContext): string {
  const ctx = buildNotificationContext(notification);
  return [
    'Android notification context:',
    `- app: ${ctx.app || 'unknown'}`,
    `- title: ${ctx.title || '(none)'}`,
    `- body: ${ctx.body || '(none)'}`,
    `- received_at: ${ctx.receivedAt || '(unknown)'}`,
    `- amount_hint: ${ctx.amountHint || '(none)'}`,
    `- direction_hint: ${ctx.directionHint}`,
    `- counterparty_hint: ${ctx.counterpartyHint || '(none)'}`,
    `- prefilter_has_money: ${ctx.signals.hasMoney ? 'yes' : 'no'}`,
    `- prefilter_has_transfer_signal: ${ctx.signals.hasTransferSignal ? 'yes' : 'no'}`,
    '- raw_fields:',
    `  - text: ${ctx.raw.text || '(empty)'}`,
    `  - bigText: ${ctx.raw.bigText || '(empty)'}`,
    `  - subText: ${ctx.raw.subText || '(empty)'}`,
    `  - summaryText: ${ctx.raw.summaryText || '(empty)'}`,
    `  - extraInfoText: ${ctx.raw.extraInfoText || '(empty)'}`,
  ].join('\n');
}
