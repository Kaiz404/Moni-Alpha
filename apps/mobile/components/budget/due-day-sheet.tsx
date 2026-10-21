import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { OptionPickerSheet } from '@/components/sheets/option-picker-sheet';
import { dayLabel } from '@/lib/dates/day-label';
import { toLocalDateInput } from '@/lib/dates/local-date-input';

const DAYS_AHEAD = 31;

function ordinal(day: number): string {
  const tens = day % 100;
  if (tens >= 11 && tens <= 13) return `${day}th`;
  return `${day}${['th', 'st', 'nd', 'rd'][day % 10] ?? 'th'}`;
}

/**
 * The bill's due date: today and the next 30 days, so every day of the month
 * is one tap away. Mounted by the page itself, because the sheet host's
 * `date` kind only lists past days.
 */
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
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });
    return () => subscription.remove();
  }, [open, onDismiss]);

  if (!mounted) return null;
  const today = new Date();
  const options = Array.from({ length: DAYS_AHEAD }, (_, ahead) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + ahead);
    const id = toLocalDateInput(date);
    return {
      id,
      name: dayLabel(id, today),
      meta: monthly ? `Every month on the ${ordinal(date.getDate())}` : undefined,
    };
  });
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
        size="large"
        options={options}
        selectedId={selected}
        onPick={onPick}
      />
    </View>
  );
}
