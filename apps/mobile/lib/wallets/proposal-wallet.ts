import type { CreateProposedTransaction } from '@repo/types';
import { resolveDefaultWalletId } from '@/lib/wallets/default-wallet';

/** Matches @repo/types wallet default when no wallet is resolved yet. */
export const FALLBACK_CURRENCY = 'USD';

export type ProposalWallet = {
  id: string;
  currency?: string | null;
};

export function currencyForWallet(
  wallets: readonly ProposalWallet[],
  walletId: string | null | undefined,
): string | null {
  if (!walletId) return null;
  const w = wallets.find((x) => x.id === walletId);
  if (!w?.currency) return null;
  const code = w.currency.trim().toUpperCase();
  return code.length === 3 ? code : null;
}

function normalizeCurrency(code: string | null | undefined): string | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return normalized.length === 3 ? normalized : null;
}

/** True when wallet and proposal currency match, or either side is unset. */
export function currenciesAlign(
  wallets: readonly ProposalWallet[],
  walletId: string | null | undefined,
  currency: string | null | undefined,
): boolean {
  const walletCur = currencyForWallet(wallets, walletId);
  const proposalCur = normalizeCurrency(currency);
  if (!walletCur || !proposalCur) return true;
  return walletCur === proposalCur;
}

export function displayCurrencyForProposal(
  proposal: { walletId: string | null; currency: string },
  wallets: readonly ProposalWallet[],
  defaultWalletId: string | null = null,
): string {
  const proposalCur = normalizeCurrency(proposal.currency);
  const walletCur =
    currencyForWallet(wallets, proposal.walletId) ?? currencyForWallet(wallets, defaultWalletId);

  if (walletCur && proposalCur && walletCur === proposalCur) {
    return walletCur;
  }
  if (proposalCur) return proposalCur;
  return walletCur ?? FALLBACK_CURRENCY;
}

/** Wallet pre-selection for review / quick-approve — skips default when currency disagrees. */
export function resolveInitialWalletId(
  proposal: { walletId: string | null; currency: string },
  wallets: readonly { id: string }[],
  defaultWalletId: string | null,
): string | null {
  if (proposal.walletId) return proposal.walletId;
  const defaultId = resolveDefaultWalletId(wallets, defaultWalletId);
  if (!defaultId) return null;
  if (currenciesAlign(wallets, defaultId, proposal.currency)) {
    return defaultId;
  }
  return null;
}

export function applyDefaultWallet(
  proposal: CreateProposedTransaction,
  candidateWallets: readonly { id: string }[],
  defaultWalletId: string | null,
): CreateProposedTransaction {
  if (proposal.walletId) return proposal;
  const resolved = resolveDefaultWalletId(candidateWallets, defaultWalletId);
  if (!resolved) return proposal;
  return { ...proposal, walletId: resolved };
}

export function applyWalletCurrency(
  proposal: CreateProposedTransaction,
  wallets: readonly ProposalWallet[],
): CreateProposedTransaction {
  const currency = currencyForWallet(wallets, proposal.walletId) ?? FALLBACK_CURRENCY;
  return { ...proposal, currency };
}

export function finalizeProposalWallet(
  proposal: CreateProposedTransaction,
  wallets: readonly ProposalWallet[],
  defaultWalletId: string | null,
  options?: {
    /** Receipts always land on the default wallet. */
    forceDefaultWallet?: boolean;
    /** Notifications keep AI-extracted currency from the bank message. */
    currencyFromWallet?: boolean;
  },
): CreateProposedTransaction {
  let p = proposal;
  if (options?.forceDefaultWallet) {
    p = { ...p, walletId: null, walletHint: null };
  }
  p = applyDefaultWallet(p, wallets, defaultWalletId);
  if (options?.currencyFromWallet === false) {
    if (!currenciesAlign(wallets, p.walletId, p.currency)) {
      p = { ...p, walletId: null };
    }
  } else {
    p = applyWalletCurrency(p, wallets);
  }
  return p;
}
