import { Redirect } from 'expo-router';

/** Legacy path `/budgets` → screen lives at `app/(routes)/budget/budgets.tsx` */
export default function BudgetsRedirect() {
  return <Redirect href="/budget/budgets" />;
}
