import { Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  SquircleView,
  squircleSmoothing,
} from '@/components/ui/squircle-view';
import {
  TransactionDetailsSheetContent,
  type TransactionDetailsValue,
} from './transaction-details-sheet-content';

type TransactionDetailsSheetProps = {
  visible: boolean;
  isTransfer: boolean;
  value: TransactionDetailsValue;
  locationLoading: boolean;
  locationUnavailable: boolean;
  onChange: (patch: Partial<TransactionDetailsValue>) => void;
  onClose: () => void;
};

/** Non-Android fallback for the native Android transaction details sheet. */
export function TransactionDetailsSheet({
  visible,
  onClose,
  ...props
}: TransactionDetailsSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View className="flex-1 justify-end bg-black/40">
        <SquircleView
          className="max-h-[88%] overflow-hidden rounded-[28px] bg-canvas"
          cornerSmoothing={squircleSmoothing.hero}
        >
          <View
            className="max-h-full px-5 pb-3 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <View className="mb-3 h-1.5 w-10 self-center rounded-full bg-border" />
            <TransactionDetailsSheetContent
              {...props}
              onClose={onClose}
            />
          </View>
        </SquircleView>
      </View>
    </Modal>
  );
}
