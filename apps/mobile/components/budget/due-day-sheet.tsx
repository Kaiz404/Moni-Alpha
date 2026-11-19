import { PageGridPicker } from '@/components/sheets/grid-picker-sheet';
import { Text } from '@/components/ui/text';
import { addDays } from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';
import { dayGrid, pageOf } from '@/lib/dates/grid-pages';

/** Today and the next 30 days, so every day of the month is one tap away. */
const DAYS_AHEAD = 30;

/** The bill's due date: a month of days at a time, today to 30 days ahead. */
export function DueDaySheet({
  open,
  selected,
  monthly,
  onPick,
  onDismiss,
}: {
  open: boolean;
  selected: string | null;
  monthly: boolean;
  onPick: (date: string) => void;
  onDismiss: () => void;
}) {
  const today = deviceCalendar.dayKey(new Date());
  const layout = dayGrid(today, addDays(today, DAYS_AHEAD), today, selected);
  return (
    <PageGridPicker
      open={open}
      onDismiss={onDismiss}
      title="Due date"
      layout={layout}
      selectedId={selected}
      startPage={pageOf(layout, selected)}
      onPick={onPick}
      footer={
        monthly ? (
          <Text
            variant="meta"
            className="text-center text-muted"
          >
            Repeats every month on this day.
          </Text>
        ) : null
      }
    />
  );
}
