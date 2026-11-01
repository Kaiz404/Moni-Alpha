/**
 * Alerts that move the user's own money rather than spend it: an e-wallet reload. Deterministic and
 * on-device, because notification extraction only returns income or expense. The wording lives here
 * and the banks and e-wallets live in `institutions.ts`, so a new bank is one row there.
 */
import {
  institutionNamedIn,
  institutionOfWallet,
  KNOWN_INSTITUTIONS,
  moneySideOfWallet,
  type Institution,
  type InstitutionWallet,
  type MoneySide,
} from './institutions';

export type MovementKind = 'reload';

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

function institutionOfAlert(
  alert: MovementAlert,
  wallet: MovementWallet | undefined,
  table: readonly Institution[],
): Institution | null {
  const byWallet = wallet ? institutionOfWallet(wallet, table) : null;
  if (byWallet) return byWallet;
  return alert.sourceApp ? institutionOfWallet({ id: '', name: null, notificationPackage: alert.sourceApp }, table) : null;
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
  const side = wallet
    ? moneySideOfWallet(wallet, table)
    : (institutionOfAlert(alert, wallet, table)?.kind ?? null);
  return reload(alert, wallet, side, wallets, table);
}

export function isTrackedMovement(movement: Movement | UntrackedMovement | null): movement is Movement {
  return !!movement && !('untracked' in movement);
}
