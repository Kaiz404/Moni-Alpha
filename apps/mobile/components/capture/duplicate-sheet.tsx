import { useEffect } from 'react';
import { BackHandler, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Press } from '@/components/ui/press';
import { Sheet } from '@/components/ui/sheet/sheet';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import {
  TransactionRowBody,
  rowAmount,
  rowMeta,
} from '@/components/ui/transaction-row';
import { clockTime } from '@/lib/capture/clock-time';
import type { DuplicateCopy } from '@/lib/capture/type-duplicate';
import { formatDay } from '@/lib/dates/day-label';
import type { TransactionRowData } from '@/lib/transactions/row';
import { tid } from '@/lib/test-ids';

export type DuplicateHit = DuplicateCopy & {
  row: TransactionRowData;
};

type DuplicateSheetProps = {
  hit: DuplicateHit;
  open: boolean;
  onDismiss: () => void;
  onExited: () => void;
  onReview: () => void;
  onAddAnyway: () => void;
  onChangeAmount: () => void;
};

/**
 * V2A-CaptureTypeDuplicate: the typed entry repeats a saved row or a capture
 * waiting in Review. It shows that row, timed when it is today's, and three
 * ways on; the row opens it too.
 */
export function DuplicateSheet({
  hit,
  open,
  onDismiss,
  onExited,
  onReview,
  onAddAnyway,
  onChangeAmount,
}: DuplicateSheetProps) {
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

  const at = new Date(hit.row.date);
  const meta =
    formatDay(at) === 'Today' && hit.row.wallet
      ? `${clockTime(at)} · ${hit.row.wallet}`
      : rowMeta(hit.row, 'date');

  return (
    <Sheet
      open={open}
      onDismiss={onDismiss}
      onExited={onExited}
      size="fit"
      title={hit.title}
      closeLabel="Close"
    >
      <View className="gap-3.5">
        <View className="gap-2 px-1">
          <StatusPill
            tone="near"
            label="Looks like a duplicate"
          />
          <Text
            variant="body"
            className="text-foreground"
          >
            {hit.message}
          </Text>
        </View>
        <View className="overflow-hidden rounded-card bg-card py-1.5">
          <Press
            testID={tid('capture', 'duplicate', 'row')}
            accessibilityLabel={`${hit.row.title}, ${meta}, ${rowAmount(hit.row)}`}
            onPress={onReview}
          >
            <TransactionRowBody
              row={hit.row}
              meta={meta}
              amount={rowAmount(hit.row)}
            />
          </Press>
        </View>
        <View className="gap-2.5">
          <Button
            testID={tid('capture', 'duplicate', 'review')}
            pinned
            label="Review that one"
            onPress={onReview}
          />
          <Button
            testID={tid('capture', 'duplicate', 'add-anyway')}
            pinned
            variant="secondary"
            label="Add mine anyway"
            onPress={onAddAnyway}
          />
          <Button
            testID={tid('capture', 'duplicate', 'change-amount')}
            variant="tertiary"
            label="Change the amount"
            onPress={onChangeAmount}
          />
        </View>
      </View>
    </Sheet>
  );
}
