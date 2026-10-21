import { useEffect } from 'react';
import { BackHandler, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet/sheet';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import {
  TransactionRowBody,
  rowAmount,
  rowMeta,
} from '@/components/ui/transaction-row';
import type { DuplicateCopy } from '@/lib/capture/type-duplicate';
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
 * waiting in Review. It shows that row and three ways on.
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

  return (
    <Sheet
      open={open}
      onDismiss={onDismiss}
      onExited={onExited}
      size="fit"
      title={hit.title}
      closeLabel="Close"
    >
      <View className="gap-4">
        <View className="gap-2.5">
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
        <View className="rounded-card bg-card py-1.5">
          <TransactionRowBody
            row={hit.row}
            meta={rowMeta(hit.row, 'date')}
            amount={rowAmount(hit.row)}
          />
        </View>
        <View className="gap-2">
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
