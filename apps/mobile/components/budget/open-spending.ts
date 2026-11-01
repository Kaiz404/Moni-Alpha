import { router } from 'expo-router';

import type { MonthKey } from '@/lib/finance/budget-month';
import { spendingParams, type SpendingScope } from '@/lib/reports/report';

/** Pushes the page listing a Budget row's payments. */
export function openSpending(scope: SpendingScope, month: MonthKey): void {
  router.push({ pathname: '/budget/spending', params: spendingParams(scope, month) });
}
