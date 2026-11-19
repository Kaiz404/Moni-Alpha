import { PageGridPicker } from '@/components/sheets/grid-picker-sheet';
import { Button } from '@/components/ui/button';
import { addMonths, dateLabel, dayOfMonth, parseDayKey } from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';
import { dayGrid, pageOf } from '@/lib/dates/grid-pages';
import { tid } from '@/lib/test-ids';

const MONTHS_AHEAD = 12;

/** A local `YYYY-MM-DD` for the debt pages' due-date label: "Fri 30 Oct". */
export function dueLabel(
  dueDate: string | null,
  now = new Date(),
): string {
  const due = dueDate ? parseDayKey(dueDate) : null;
  return due ? dateLabel(due, deviceCalendar.dayKey(now)) : 'No date';
}

/**
 * The debt's due date: a month of days at a time, today to a year ahead, with No date under them.
 * It opens on the date already set, even an overdue one, and No date shows picked when there is none.
 */
export function DueDateSheet({
  open,
  selected,
  onPick,
  onDismiss,
}: {
  open: boolean;
  selected: string | null;
  onPick: (dueDate: string | null) => void;
  onDismiss: () => void;
}) {
  const today = deviceCalendar.dayKey(new Date());
  const layout = dayGrid(today, addMonths(today, MONTHS_AHEAD, dayOfMonth(today)), today, selected);
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
        <Button
          testID={tid('debts', 'due', 'none')}
          variant={selected === null ? 'primary' : 'secondary'}
          selected={selected === null}
          icon="calendar-remove-outline"
          label="No date"
          onPress={() => onPick(null)}
        />
      }
    />
  );
}
