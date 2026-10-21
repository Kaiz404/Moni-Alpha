import { OptionPickerSheet } from '@/components/sheets/option-picker-sheet';
import type { SheetFrameProps } from '@/components/ui/sheet/sheet';
import type { SheetRequestOf } from '@/lib/sheet/sheet-store';

/** "Choose month" on the Budget tab: each month with what was spent in it. */
export function MonthSheet({
  request,
  onPick,
  ...frame
}: SheetFrameProps & {
  request: SheetRequestOf<'month'>;
  onPick: (month: string) => void;
}) {
  return (
    <OptionPickerSheet
      {...frame}
      title="Choose month"
      options={request.months.map((item) => ({
        id: item.month,
        name: item.name,
        meta: item.meta,
      }))}
      selectedId={request.selected}
      onPick={onPick}
    />
  );
}
