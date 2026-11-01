import { router } from 'expo-router';

import { ListCard } from '@/components/ui/list-card';
import { NavRow } from '@/components/ui/nav-row';
import type { MonthKey } from '@/lib/finance/budget-month';
import { tid } from '@/lib/test-ids';

/** The Budget tab's way into Reports, opening on the month the tab shows. */
export function ReportsLink({ month }: { month: MonthKey }) {
  return (
    <ListCard className="mt-2">
      <NavRow
        testID={tid('budget', 'reports')}
        title="Reports"
        icon="chart-bar"
        tint="lilac"
        onPress={() => router.push({ pathname: '/reports', params: { month } })}
      />
    </ListCard>
  );
}
