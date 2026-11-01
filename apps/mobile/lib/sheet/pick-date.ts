import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';

import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { orderRange, type ActivityRange } from '@/lib/finance/activity-filter';
import { openSheet } from '@/lib/sheet/sheet-store';

/**
 * Picks a past or present day and resolves `YYYY-MM-DD`, or null when dismissed. Android opens the
 * system calendar, by the owner's choice over the board's list of days. iOS keeps the date sheet.
 */
export function pickDate(selected: string): Promise<string | null> {
  if (Platform.OS !== 'android') return openSheet({ kind: 'date', selected });
  return new Promise((resolve) => {
    DateTimePickerAndroid.open({
      mode: 'date',
      value: new Date(`${selected}T12:00:00`),
      maximumDate: new Date(),
      onChange: (event, date) =>
        resolve(event.type === 'set' && date ? toLocalDateInput(date) : null),
    });
  });
}

/**
 * Opens Activity's date sheet and resolves the dates, null for all time, or nothing when
 * dismissed. Only one sheet opens at a time, so where `pickDate` is a sheet the date sheet closes
 * around it and comes back holding the days picked so far.
 */
export async function pickActivityRange(
  range: ActivityRange | null,
): Promise<{ range: ActivityRange | null } | null> {
  let shown = range;
  while (true) {
    const result = await openSheet({ kind: 'activityRange', range: shown });
    if (!result || !('editing' in result)) return result;
    const day = await pickDate(result.draft[result.editing]);
    shown = day
      ? orderRange(day, result.editing === 'from' ? result.draft.to : result.draft.from)
      : result.draft;
  }
}
