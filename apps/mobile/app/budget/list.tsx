import { Redirect } from 'expo-router';

/** Home and Profile still link here; budgets are edited on `/budget/edit` now. */
export default function BudgetListRedirect() {
  return <Redirect href="/budget/edit" />;
}
