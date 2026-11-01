import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';

import { toLocalDateInput } from '@/lib/dates/local-date-input';
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
