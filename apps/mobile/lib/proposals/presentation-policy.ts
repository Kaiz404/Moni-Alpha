import type { ProposedTransaction } from '@repo/types';

/**
 * Delivery is deliberately based on how the record entered Moni, not how
 * confident the extractor was. Background notifications stay quiet while a
 * person who has just asked Moni to capture something is taken to its review.
 */
export type ProposalPresentation = 'immediate' | 'quiet';

export function proposalPresentationForSource(
  sourceType: ProposedTransaction['sourceType'] | null | undefined,
): ProposalPresentation {
  return sourceType === 'image' || sourceType === 'text' ? 'immediate' : 'quiet';
}

export function quietReviewCopy(queueLength: number) {
  const remaining = Math.max(0, queueLength - 1);

  return {
    remaining,
    queueLabel: remaining === 0 ? 'One review waiting' : `${remaining} more to review`,
    primaryLabel: 'Continue',
    secondaryLabel: 'Later',
  } as const;
}
