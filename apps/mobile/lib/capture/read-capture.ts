import { decimalToMinor, type MinorAmount } from '@repo/types';

import { getAiClient } from '@/lib/ai/client';
import type {
  ExtractedTransaction,
  ExtractResult,
} from '@/lib/ai/client/types';
import {
  extractDateContext,
  resolveOccurredAt,
} from '@/lib/ai/occurred-at';
import { matchRoutine, merchantKey } from '@/lib/ai/routine';
import type {
  CaptureDraft,
  CaptureQuote,
  ReadResult,
} from '@/lib/capture/capture-stage';
import type {
  FinanceCategory,
  FinanceTransaction,
  FinanceWallet,
} from '@/lib/finance/types';

export type ReadContext = {
  /** Main-currency wallets only: a live capture never lands in another currency. */
  wallets: FinanceWallet[];
  categories: Pick<FinanceCategory, 'id' | 'name' | 'type' | 'isActive'>[];
  /** Newest first. */
  history: FinanceTransaction[];
  defaultWalletId: string | null;
};

const UNREADABLE = "Moni couldn't find a total";

function categoryFor(
  extraction: ExtractedTransaction,
  kind: CaptureDraft['kind'],
  context: ReadContext,
): string | null {
  const active = context.categories.filter(
    (category) => category.isActive && category.type === kind,
  );
  const routine = matchRoutine(
    {
      type: kind,
      currency: context.wallets[0]?.currency ?? '',
      amountMinor: decimalToMinor(extraction.amount),
      merchant: extraction.merchant,
      location: null,
      sourceApp: null,
    },
    context.history,
    new Set(active.map((category) => category.id)),
  );
  if (routine.categoryId) return routine.categoryId;
  const hint = extraction.categoryHint?.trim().toLowerCase();
  if (!hint) return null;
  return (
    active.find((category) => category.name.toLowerCase() === hint)?.id ??
    active.find((category) =>
      category.name.toLowerCase().includes(hint),
    )?.id ??
    null
  );
}

/** The wallet the words named, else the one that paid this shop last, else the default. */
function walletFor(
  extraction: ExtractedTransaction,
  context: ReadContext,
): { walletId: string | null; evidence: string | null } {
  const ids = new Set(context.wallets.map((wallet) => wallet.id));
  if (extraction.walletId && ids.has(extraction.walletId)) {
    return { walletId: extraction.walletId, evidence: null };
  }
  const key = merchantKey(extraction.merchant);
  const visits = key
    ? context.history.filter(
        (row) => ids.has(row.walletId) && merchantKey(row.merchant) === key,
      )
    : [];
  const last = visits[0];
  if (last) {
    const streak = visits.findIndex((row) => row.walletId !== last.walletId);
    const count = streak === -1 ? visits.length : streak;
    const name = context.wallets.find((w) => w.id === last.walletId)?.name;
    return {
      walletId: last.walletId,
      evidence: `You didn't say a wallet. ${name} paid your last ${count === 1 ? '' : `${count} `}${extraction.merchant} visit${count === 1 ? '' : 's'}.`,
    };
  }
  const fallback =
    (context.defaultWalletId && ids.has(context.defaultWalletId)
      ? context.defaultWalletId
      : null) ??
    context.wallets[0]?.id ??
    null;
  const name = context.wallets.find((w) => w.id === fallback)?.name;
  return {
    walletId: fallback,
    evidence: name ? `You didn't say a wallet. Moni picked ${name}.` : null,
  };
}

/** Turns the reader's extraction into the check page's draft, or says why it cannot. */
export function draftFromExtraction(
  result: ExtractResult,
  context: ReadContext,
  capturedAt: Date,
): ReadResult {
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
  return {
    status: 'ok',
    draft: {
      kind,
      merchant: extraction.merchant ?? extraction.description ?? '',
      amountMinor,
      categoryId: categoryFor(extraction, kind, context),
      walletId: wallet.walletId,
      transactionDate: resolveOccurredAt(extraction.occurredAt, capturedAt),
      evidence: wallet.evidence ?? extraction.reasoning,
    },
  };
}

/** Sends what was heard or scanned to the reader. Nothing is written anywhere. */
export async function readCapture(
  quote: CaptureQuote,
  context: ReadContext,
): Promise<ReadResult> {
  const capturedAt = new Date();
  const wallets = context.wallets.map((wallet) => ({
    id: wallet.id,
    name: wallet.name,
    type: wallet.type,
    currency: wallet.currency,
  }));
  const client = getAiClient();
  try {
    const result =
      quote.source === 'voice'
        ? await client.extractFromText({
            text: quote.text,
            wallets,
            ...extractDateContext(capturedAt),
          })
        : await client.extractFromImage({
            imageUri: quote.imageUri,
            wallets,
            ...extractDateContext(capturedAt),
          });
    return draftFromExtraction(result, context, capturedAt);
  } catch (error) {
    return {
      status: 'unavailable',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
