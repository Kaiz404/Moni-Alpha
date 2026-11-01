import { STREAK } from '@/lib/ai/routine';

export type ReviewStatus = { tone: 'near' | 'review' | 'onTrack'; label: string };

/** The pill on the Review card's source row. A warning always outranks how familiar the merchant is. */
export function reviewStatus(facts: {
  hasWallet: boolean;
  paired: boolean;
  maybeDuplicate: boolean;
  timesFiled: number;
}): ReviewStatus | null {
  if (!facts.hasWallet) return { tone: 'near', label: 'Needs a wallet' };
  if (facts.paired) return { tone: 'review', label: 'Same payment' };
  if (facts.maybeDuplicate) return { tone: 'review', label: 'Maybe a duplicate' };
  // The board draws only 14 and 1. Usual starts where Moni itself treats a merchant as routine.
  if (facts.timesFiled >= STREAK) return { tone: 'onTrack', label: 'Usual for you' };
  if (facts.timesFiled >= 1) return { tone: 'onTrack', label: 'Seen before' };
  return null;
}
