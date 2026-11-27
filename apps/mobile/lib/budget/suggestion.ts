import { observable } from '@legendapp/state';
import type { SuggestTarget } from '@repo/core';
import type { MinorAmount } from '@repo/types';

/**
 * An amount picked on Ask Moni that Edit budgets takes into its draft when it comes back into view,
 * so it saves with the page's other changes.
 */
export const pickedSuggestion$ = observable<{ target: SuggestTarget; amountMinor: MinorAmount } | null>(null);
