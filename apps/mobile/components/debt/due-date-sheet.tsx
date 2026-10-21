import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import {
  OptionPickerSheet,
  type PickerOption,
} from '@/components/sheets/option-picker-sheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatDate } from '@/lib/dates/day-label';
import {
  parseLocalDateInput,
  toLocalDateInput,
} from '@/lib/dates/local-date-input';

const NONE = 'none';

/** A local `YYYY-MM-DD` for the debt pages' due-date label: "Fri 30 Oct". */
export function dueLabel(
  dueDate: string | null,
  now = new Date(),
): string {
  const due = dueDate ? parseLocalDateInput(dueDate) : null;
  return due ? formatDate(due, now) : 'No date';
}

function dueChoices(
  now: Date,
  current: string | null,
): { id: string; name: string; meta: string }[] {
  const day = (offsetDays: number, offsetMonths = 0) =>
    toLocalDateInput(
      new Date(
        now.getFullYear(),
        now.getMonth() + offsetMonths,
        now.getDate() + offsetDays,
      ),
    );
  const endOfMonth = toLocalDateInput(
    new Date(now.getFullYear(), now.getMonth() + 1, 0),
  );
  const dated = [
    { id: day(7), name: 'In a week' },
    { id: endOfMonth, name: 'End of month' },
    { id: day(0, 1), name: 'In a month' },
  ];
  if (current && !dated.some((choice) => choice.id === current))
    dated.unshift({ id: current, name: 'As agreed' });
  return [
    { id: NONE, name: 'No date', meta: 'Nothing coming up' },
    ...dated.map((choice) => ({
      ...choice,
      meta: dueLabel(choice.id, now),
    })),
  ];
}

/**
 * Due date picker for the debt pages, mounted by the page itself: the sheet
 * host's `date` kind only lists past days. Picking closes it.
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
  const tokens = useThemeTokens();
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onDismiss();
        return true;
      },
    );
    return () => subscription.remove();
  }, [open, onDismiss]);

  if (!mounted) return null;
  const options: PickerOption[] = dueChoices(
    new Date(),
    selected,
  ).map((choice) => ({
    ...choice,
    leading: (
      <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-sand">
        <IconSymbol
          name={
            choice.id === NONE
              ? 'calendar-remove-outline'
              : 'calendar-clock'
          }
          size={20}
          color={tokens.foreground}
        />
      </View>
    ),
  }));
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={open ? 'auto' : 'none'}
    >
      <OptionPickerSheet
        open={open}
        onDismiss={onDismiss}
        onExited={() => setMounted(false)}
        title="Due date"
        options={options}
        selectedId={selected ?? NONE}
        onPick={(id) => onPick(id === NONE ? null : id)}
      />
    </View>
  );
}
