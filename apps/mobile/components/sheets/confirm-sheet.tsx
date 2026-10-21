import { Button } from '@/components/ui/button';
import { Sheet, type SheetFrameProps } from '@/components/ui/sheet/sheet';
import { Text } from '@/components/ui/text';
import type { SheetRequestOf } from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';

type ConfirmSheetProps = SheetFrameProps & {
  request: SheetRequestOf<'confirm'>;
  onConfirm: () => void;
};

/** Medium sheet that fits its content, with two pinned actions split 50/50, the safe one first. */
export function ConfirmSheet({ request, onConfirm, ...frame }: ConfirmSheetProps) {
  return (
    <Sheet
      {...frame}
      size="fit"
      title={request.title}
      actions={
        <>
          <Button
            testID={tid('sheet', 'cancel')}
            className="flex-1"
            pinned
            variant="secondary"
            label={request.cancelLabel ?? 'Keep it'}
            onPress={frame.onDismiss}
          />
          <Button
            testID={tid('sheet', 'confirm')}
            className="flex-1"
            pinned
            variant={request.destructive ? 'destructive' : 'primary'}
            icon={request.destructive ? 'trash-can-outline' : undefined}
            label={request.confirmLabel}
            onPress={onConfirm}
          />
        </>
      }
    >
      {request.message ? (
        <Text className="text-[15px] leading-[21px] text-ink-2">{request.message}</Text>
      ) : null}
    </Sheet>
  );
}
