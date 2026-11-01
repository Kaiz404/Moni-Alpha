import { useMemo, useState } from 'react';
import { Platform, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { PickerField } from '@/components/ui/picker-field';
import { Sheet, type SheetFrameProps } from '@/components/ui/sheet/sheet';
import { formatDate } from '@/lib/dates/day-label';
import { toLocalDateInput } from '@/lib/dates/local-date-input';
import {
  localDay,
  monthRange,
  orderRange,
  rangePresets,
  sameRange,
  type ActivityRange,
} from '@/lib/finance/activity-filter';
import { monthKey } from '@/lib/finance/budget-month';
import { pickDate } from '@/lib/sheet/pick-date';
import type { SheetRequestOf, SheetResult } from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';

/** Activity's dates: a preset applies at once; From and To apply on the button. */
export function RangeSheet({
  request,
  onPick,
  ...frame
}: SheetFrameProps & {
  request: SheetRequestOf<'activityRange'>;
  onPick: (result: SheetResult<'activityRange'>) => void;
}) {
  const now = useMemo(() => new Date(), []);
  const presets = useMemo(() => rangePresets(now), [now]);
  const [draft, setDraft] = useState<ActivityRange>(
    request.range ?? { from: monthRange(monthKey(now)).from, to: toLocalDateInput(now) },
  );

  const edit = async (end: keyof ActivityRange) => {
    if (Platform.OS !== 'android') {
      onPick({ editing: end, draft });
      return;
    }
    const day = await pickDate(draft[end]);
    if (day) setDraft(orderRange(day, end === 'from' ? draft.to : draft.from));
  };

  return (
    <Sheet
      {...frame}
      size="fit"
      title="Dates"
      closeLabel="Close"
    >
      <View className="gap-4">
        <View className="flex-row flex-wrap gap-2">
          {presets.map((preset) => (
            <Chip
              key={preset.key}
              testID={tid('sheet', 'range', preset.key)}
              label={preset.label}
              selected={sameRange(preset.range, request.range)}
              onPress={() => onPick({ range: preset.range })}
            />
          ))}
        </View>
        <View className="flex-row gap-2">
          <PickerField
            testID={tid('sheet', 'range', 'from')}
            label="From"
            value={formatDate(localDay(draft.from), now)}
            onPress={() => void edit('from')}
            className="min-w-0 flex-1"
          />
          <PickerField
            testID={tid('sheet', 'range', 'to')}
            label="To"
            value={formatDate(localDay(draft.to), now)}
            onPress={() => void edit('to')}
            className="min-w-0 flex-1"
          />
        </View>
        <Button
          testID={tid('sheet', 'range', 'apply')}
          label="Show these dates"
          onPress={() => onPick({ range: draft })}
        />
      </View>
    </Sheet>
  );
}
