import { formatMoney, monthName, type ReviewedProposal } from '@repo/core';
import type { MinorAmount } from '@repo/types';

type Capture = { id: string; merchant: string | null; description: string | null; amountMinor: MinorAmount | null; currency: string };

/**
 * What Home's Review drawer shows (#104), from `?review=`: one capture at a time, every waiting capture
 * as a list, or Recently reviewed. No value means the drawer is shut.
 */
export type ReviewView = 'deck' | 'list' | 'recent';

export function parseReviewView(value: string | null): ReviewView | null {
  if (value === null) return null;
  return value === 'list' || value === 'recent' ? value : 'deck';
}

/** Home with the Review drawer open, at one capture when it names one. */
export function reviewHref(captureId?: string): string {
  return captureId ? `/home?review=deck&capture=${encodeURIComponent(captureId)}` : '/home?review=deck';
}

export const RECENTLY_REVIEWED_HREF = '/home?review=recent';

/** Where an old `/review` link lands: `?view=recent` was Recently reviewed, `?capture=` one capture. */
export function oldReviewHref(view: string | null, capture: string | null): string {
  return view === 'recent' ? RECENTLY_REVIEWED_HREF : reviewHref(capture ?? undefined);
}

/** A capture's name on a row or a toast: the merchant, else what Moni read, else "Capture". */
export function captureName(capture: Pick<Capture, 'merchant' | 'description'>): string {
  return capture.merchant?.trim() || capture.description?.trim() || 'Capture';
}

/** The header's line: what the waiting captures add up to in the main currency, or that nothing waits. */
export function waitingLine(waiting: readonly Capture[], currency: string): string {
  if (waiting.length === 0) return 'Nothing waiting';
  const total = waiting.filter((capture) => capture.currency === currency).reduce((sum, capture) => sum + Number(capture.amountMinor ?? 0), 0);
  return `${formatMoney(total as MinorAmount, currency)} not counted yet`;
}

/** The list's toolbar: "3 waiting · oldest first". */
export function waitingCount(count: number): string {
  return `${count} waiting · oldest first`;
}

/**
 * The toast after Approve: one capture names its category ("Added to Food & Dining"), several are
 * counted, a saved rule says so, and a ticked capture that still needs a wallet is named.
 */
export function approvedText({
  approved,
  category,
  ruleSaved,
  skipped,
}: {
  approved: readonly Pick<Capture, 'merchant' | 'description'>[];
  category: string | null;
  ruleSaved: boolean;
  skipped: readonly Pick<Capture, 'merchant' | 'description'>[];
}): string {
  const head =
    approved.length === 1 ? (category ? `Added to ${category}` : `${captureName(approved[0]!)} approved`) : `${approved.length} approved`;
  const rule = ruleSaved && approved.length === 1 ? ', similar ones will be Auto' : '';
  const wait = skipped.length ? ` · ${captureName(skipped[0]!)} still needs a wallet` : '';
  return `${head}${rule}${wait}`;
}

export function notMineText(count: number): string {
  return `${count} not mine`;
}

/** All caught up's line: today's decisions and what Approve added to this month, in the main currency. */
export function caughtUpLine(reviewed: readonly ReviewedProposal[], today: string, dayOf: (at: string) => string, currency: string): string {
  const todays = reviewed.filter((proposal) => dayOf(proposal.reviewedAt) === today);
  const approved = todays.filter((proposal) => proposal.status === 'approved');
  const notMine = todays.length - approved.length;
  if (todays.length === 0) return 'Nothing waiting. New captures land here.';
  const added = approved.filter((proposal) => proposal.currency === currency).reduce((sum, proposal) => sum + Number(proposal.amountMinor ?? 0), 0);
  const counts = [approved.length ? `${approved.length} approved` : null, notMine ? `${notMine} not mine` : null].filter(Boolean).join(', ');
  return approved.length ? `${counts} · ${formatMoney(added as MinorAmount, currency)} added to ${monthName(today.slice(0, 7))}` : counts;
}
