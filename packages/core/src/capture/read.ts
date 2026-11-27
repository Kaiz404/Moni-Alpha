import { decimalToMinor, type ExtractResult, type ExtractedTransaction, type MinorAmount } from '@repo/types';

import { formatMoney } from '../glossary';
import { merchantKey } from '../read-model/merchants';
import { compactWalletNames } from '../read-model/transaction-row';
import type { FinanceCategory, FinanceTransaction, FinanceWallet } from '../read-model/types';
import { guessCategory } from './category-guess';
import { resolveOccurredAt } from './occurred-at';

export type ReadContext = {
  /** Main-currency wallets only: a live capture never lands in another currency. */
  wallets: FinanceWallet[];
  categories: Pick<FinanceCategory, 'id' | 'name' | 'type' | 'isActive'>[];
  /** Newest first. */
  history: FinanceTransaction[];
  defaultWalletId: string | null;
};

/** What Moni filled in from what it heard, read or was told, for the user to check before adding. */
export type ReadDraft = {
  kind: 'expense' | 'income';
  merchant: string;
  amountMinor: MinorAmount;
  categoryId: string | null;
  walletId: string | null;
  /** ISO time the purchase happened. */
  transactionDate: string;
  /** The one line that says why Moni filled the fields as it did. */
  evidence: string;
  /** How many items the receipt lists; null when the reader has no count. Never edited. */
  itemCount: number | null;
};

/** `unreadable`: Moni found no amount. `unavailable`: the reader could not be reached. */
export type ReadFailure = 'unreadable' | 'unavailable';

export type ReadDraftResult = { status: 'ok'; draft: ReadDraft } | { status: ReadFailure; reason: string };

const UNREADABLE = "Moni couldn't find a total";
const MAX_RECEIPT_ITEMS = 200;

/** The wire is cast, not parsed, so an older or odd reader can send anything here. */
export function receiptItemCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_RECEIPT_ITEMS ? value : null;
}

/** "1 item", "6 items": the check page and the Added row both say it this way. */
export function itemsLabel(count: number): string {
  return `${count} item${count === 1 ? '' : 's'}`;
}

function categoryFor(extraction: ExtractedTransaction, kind: ReadDraft['kind'], context: ReadContext): string | null {
  return guessCategory(
    { type: kind, merchant: extraction.merchant, text: extraction.description, sourceApp: null, categoryHint: extraction.categoryHint },
    context.history,
    context.categories,
  ).prefill;
}

/** The wallet the words named, else the one that paid this shop last, else the default. */
function walletFor(extraction: ExtractedTransaction, context: ReadContext): { walletId: string | null; evidence: string | null } {
  const ids = new Set(context.wallets.map((wallet) => wallet.id));
  if (extraction.walletId && ids.has(extraction.walletId)) {
    return { walletId: extraction.walletId, evidence: null };
  }
  const key = merchantKey(extraction.merchant);
  const visits = key ? context.history.filter((row) => ids.has(row.walletId) && merchantKey(row.merchant) === key) : [];
  const last = visits[0];
  if (last) {
    const streak = visits.findIndex((row) => row.walletId !== last.walletId);
    const count = streak === -1 ? visits.length : streak;
    const name = compactWalletNames(context.wallets)[last.walletId];
    return {
      walletId: last.walletId,
      evidence: `You didn't say a wallet. ${name} paid your last ${count === 1 ? '' : `${count} `}${extraction.merchant} visit${count === 1 ? '' : 's'}.`,
    };
  }
  const fallback =
    (context.defaultWalletId && ids.has(context.defaultWalletId) ? context.defaultWalletId : null) ?? context.wallets[0]?.id ?? null;
  const name = context.wallets.find((w) => w.id === fallback)?.name;
  return { walletId: fallback, evidence: name ? `You didn't say a wallet. Moni picked ${name}.` : null };
}

/** Turns the reader's extraction into the draft the user checks, or says why it cannot. */
export function draftFromExtraction(result: ExtractResult, context: ReadContext, capturedAt: Date): ReadDraftResult {
  if (result.status !== 'ok') {
    return {
      status: result.status === 'unavailable' ? 'unavailable' : 'unreadable',
      reason: result.status === 'unavailable' ? result.reason : UNREADABLE,
    };
  }
  const extraction = result.extraction;
  const amountMinor = decimalToMinor(extraction.amount ?? 0) as MinorAmount;
  if (amountMinor <= 0 || extraction.type === 'transfer') {
    return { status: 'unreadable', reason: UNREADABLE };
  }
  const kind = extraction.type;
  const wallet = walletFor(extraction, context);
  const itemCount = receiptItemCount(extraction.itemCount);
  const read =
    itemCount === null
      ? null
      : `Moni read ${itemsLabel(itemCount)} and a total of ${formatMoney(amountMinor, context.wallets[0]?.currency ?? extraction.currency)}.`;
  return {
    status: 'ok',
    draft: {
      kind,
      merchant: extraction.merchant ?? extraction.description ?? '',
      amountMinor,
      categoryId: categoryFor(extraction, kind, context),
      walletId: wallet.walletId,
      transactionDate: resolveOccurredAt(extraction.occurredAt, capturedAt),
      evidence: read ? [read, wallet.evidence].filter(Boolean).join(' ') : (wallet.evidence ?? extraction.reasoning),
      itemCount,
    },
  };
}
