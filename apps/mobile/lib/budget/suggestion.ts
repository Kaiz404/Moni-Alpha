import { observable } from '@legendapp/state';
import type { MinorAmount } from '@repo/types';

/** What Moni is asked to suggest: the month's total, or one category's budget. */
export type SuggestTarget = { kind: 'total' } | { kind: 'category'; id: string; name: string };

/**
 * An amount picked on Ask Moni that Edit budgets takes into its draft when it comes back into view,
 * so it saves with the page's other changes.
 */
export const pickedSuggestion$ = observable<{ target: SuggestTarget; amountMinor: MinorAmount } | null>(null);
