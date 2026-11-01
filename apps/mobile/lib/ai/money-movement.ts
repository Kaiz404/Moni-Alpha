/**
 * Alerts that move the user's own money rather than spend it: an e-wallet reload or a credit-card
 * bill payment. Deterministic and
 * on-device, because notification extraction only returns income or expense. The wording lives here
 * and the banks and e-wallets live in `institutions.ts`, so a new bank is one row there.
 */
import {
  institutionNamedIn,
  institutionOfWallet,
  KNOWN_INSTITUTIONS,
  moneySideOfWallet,
  textNames,
  type Institution,
  type InstitutionWallet,
  type MoneySide,
} from './institutions';

export type MovementKind = 'reload' | 'card_bill';

export type MovementWallet = InstitutionWallet & {
  currency?: string | null;
  notificationAccountHint?: string | null;
};

export type MovementAlert = {
  /** Title and body as the app sent them. */
  text: string;
  walletId: string | null;
  sourceApp: string | null;
  currency: string;
  type: 'income' | 'expense' | 'transfer' | null;
};

export type Movement = {
  kind: MovementKind;
  /** Null where the alert doesn't say; Review asks. */
  fromWalletId: string | null;
  toWalletId: string | null;
  /** What the transfer row is called: "Touch 'n Go reload". */
  label: string;
  /** Why it reads this way, shown on the Review card. */
  reason: string;
  /** `high` names both wallets without doubt, so it can join the ledger unasked. */
  confidence: 'high' | 'low';
};

/**
 * The money has nowhere to go in the user's wallets, so a transfer can't record it. Staying an
 * expense keeps the only trace of that money, and the card says what would change it.
 */
export type UntrackedMovement = {
  kind: MovementKind;
  untracked: true;
  reason: string;
  institutionId: string | null;
};

const RELOAD_WORDS = /\b(re-?load(?:ed|s)?|top[- ]?up(?:s)?|topped up|tambah nilai)\b/i;
const BANK_TO_WALLET_WORDS = /\b(transfer(?:red)?|fpx|ibg|giro|duitnow)\b/i;
/** A DuitNow transfer can be to a friend's e-wallet, so it asks. */
const PERSON_RAIL = /\bduitnow\b/i;
/** Prepaid airtime, a physical TNG card, GO+ and reversals are not money into the e-wallet. */
const NOT_A_WALLET_RELOAD =
  /\b(hotlink|xpax|digi|maxis|celcom|celcomdigi|umobile|u mobile|yoodo|tunetalk|redone|prepaid|airtime|mobile (?:re-?load|top[- ]?up)|phone|card reload|rfid|refund(?:ed)?|revers(?:al|ed)|cashback|fail(?:ed)?|unsuccessful)\b|go\+/i;

/** Paying the card, in the words banks use. Amounts are blanked first, so a decimal can't end a phrase. */
const CARD_BILL_WORDS = [
  /\bcredit card (?:bill )?payment\b/i,
  /\bpa(?:id|yment)\b[^.]*?\bto\b[^.]*?\bcredit card\b/i,
  /\bpayment\b[^.]*?\b(?:to|for)\b[^.]*?\bcard\s+(?:ending|account|no\b|number|\d)/i,
  /\bbayaran kad kredit\b/i,
];
/** Spending on the card, a reminder, or a fee mention the same words. */
const NOT_A_CARD_BILL =
  /\b(?:due|overdue|statement|minimum|reminder|spent|purchase|annual fee|late fee|refund(?:ed)?|revers(?:al|ed)|fail(?:ed)?|unsuccessful)\b|\bat [a-z]|\b(?:with|using|via|on) (?:your )?(?:[a-z]+ ){0,2}(?:credit )?card\b/i;
const CARD_PAYMENT_RECEIVED = /\b(?:payment|bayaran)\b/i;

function blankAmounts(text: string): string {
  return text.replace(/\d[\d,]*\.\d{1,2}/g, '0');
}

function walletsOf(
  institution: Institution,
  wallets: readonly MovementWallet[],
  currency: string,
  table: readonly Institution[],
): MovementWallet[] {
  return wallets.filter(
    (wallet) =>
      institutionOfWallet(wallet, table)?.id === institution.id &&
      wallet.type !== 'credit' &&
      (wallet.currency ?? '').toUpperCase() === currency,
  );
}

function isCreditCardPayment(text: string, wallet: MovementWallet | undefined, alert: MovementAlert) {
  const words = blankAmounts(text);
  if (NOT_A_CARD_BILL.test(words)) return false;
  if (CARD_BILL_WORDS.some((pattern) => pattern.test(words))) return true;
  // Money arriving on a credit card, from its own issuer's alert ("We've received your payment").
  return wallet?.type === 'credit' && alert.type === 'income' && CARD_PAYMENT_RECEIVED.test(words);
}

/** The card an alert pays: by last digits, then by the bank it names, then the only card there is. */
function cardBeingPaid(
  alert: MovementAlert,
  cards: readonly MovementWallet[],
  table: readonly Institution[],
): MovementWallet | null {
  const byHint = cards.filter(
    (card) => card.notificationAccountHint && alert.text.includes(card.notificationAccountHint.trim()),
  );
  if (byHint.length === 1) return byHint[0]!;
  const named = table.filter((row) => row.kind === 'bank' && textNames(alert.text, row));
  const byName = cards.filter((card) => {
    const issuer = institutionOfWallet(card, table);
    return !!issuer && named.includes(issuer);
  });
  if (byName.length === 1) return byName[0]!;
  return cards.length === 1 && byName.length === 0 && named.length <= 1 ? cards[0]! : null;
}

function cardBill(
  alert: MovementAlert,
  wallet: MovementWallet | undefined,
  side: MoneySide | null,
  wallets: readonly MovementWallet[],
  table: readonly Institution[],
): Movement | UntrackedMovement | null {
  if (side === 'ewallet' || !isCreditCardPayment(alert.text, wallet, alert)) return null;
  const cards = wallets.filter(
    (w) => w.type === 'credit' && (w.currency ?? '').toUpperCase() === alert.currency,
  );
  if (cards.length === 0) {
    return {
      kind: 'card_bill',
      untracked: true,
      reason: 'Looks like a credit card payment. Add the card as a wallet to count it as a transfer.',
      institutionId: null,
    };
  }
  const to = wallet?.type === 'credit' ? wallet : cardBeingPaid(alert, cards, table);
  const from = wallet && wallet.type !== 'credit' ? wallet : null;
  return {
    kind: 'card_bill',
    fromWalletId: from?.id ?? null,
    toWalletId: to?.id ?? null,
    label: 'Credit card payment',
    reason:
      from && to
        ? `Looks like a credit card payment from ${from.name} to ${to.name}.`
        : 'Looks like a credit card payment. Which wallets did it move between?',
    confidence: from && to ? 'high' : 'low',
  };
}

function reload(
  alert: MovementAlert,
  wallet: MovementWallet | undefined,
  side: MoneySide | null,
  wallets: readonly MovementWallet[],
  table: readonly Institution[],
): Movement | UntrackedMovement | null {
  if (NOT_A_WALLET_RELOAD.test(alert.text)) return null;

  if (side === 'ewallet') {
    if (!RELOAD_WORDS.test(alert.text) || !wallet) return null;
    const ewallet = institutionOfWallet(wallet, table);
    const bank = institutionNamedIn(alert.text, 'bank', table);
    const banks = bank ? walletsOf(bank, wallets, alert.currency, table) : [];
    const from = banks.length === 1 ? banks[0]! : null;
    const name = ewallet?.name ?? wallet.name ?? 'E-wallet';
    return {
      kind: 'reload',
      fromWalletId: from?.id ?? null,
      toWalletId: wallet.id,
      label: `${name} reload`,
      reason: from
        ? `Looks like a ${name} reload from ${from.name}.`
        : `Looks like a ${name} reload. Which wallet paid for it?`,
      confidence: from ? 'high' : 'low',
    };
  }

  if (side !== 'bank' || alert.type !== 'expense') return null;
  const ewallet = institutionNamedIn(alert.text, 'ewallet', table);
  if (!ewallet) return null;
  if (!RELOAD_WORDS.test(alert.text) && !BANK_TO_WALLET_WORDS.test(alert.text)) return null;
  const targets = walletsOf(ewallet, wallets, alert.currency, table);
  if (targets.length === 0) {
    return {
      kind: 'reload',
      untracked: true,
      reason: `Looks like a ${ewallet.name} reload. Add a ${ewallet.name} wallet to count it as a transfer.`,
      institutionId: ewallet.id,
    };
  }
  const to = targets.length === 1 ? targets[0]! : null;
  return {
    kind: 'reload',
    fromWalletId: alert.walletId,
    toWalletId: to?.id ?? null,
    label: `${ewallet.name} reload`,
    reason: `Looks like a ${ewallet.name} reload${wallet?.name ? ` from ${wallet.name}` : ''}.`,
    confidence: to && alert.walletId && !PERSON_RAIL.test(alert.text) ? 'high' : 'low',
  };
}

export function classifyMovement(
  alert: MovementAlert,
  wallets: readonly MovementWallet[],
  table: readonly Institution[] = KNOWN_INSTITUTIONS,
): Movement | UntrackedMovement | null {
  const wallet = wallets.find((w) => w.id === alert.walletId);
  const side = moneySideOfWallet(
    wallet ?? { id: '', name: null, notificationPackage: alert.sourceApp },
    table,
  );
  return (
    cardBill(alert, wallet, side, wallets, table) ?? reload(alert, wallet, side, wallets, table)
  );
}

export function isTrackedMovement(movement: Movement | UntrackedMovement | null): movement is Movement {
  return !!movement && !('untracked' in movement);
}
