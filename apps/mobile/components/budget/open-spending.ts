import { router } from 'expo-router';

import { spendingParams, type SpendingScope, type MonthKey } from '@repo/core';

/** Pushes the page listing a Budget row's payments. */
export function openSpending(scope: SpendingScope, month: MonthKey): void {
  router.push({ pathname: '/budget/spending', params: spendingParams(scope, month) });
}
