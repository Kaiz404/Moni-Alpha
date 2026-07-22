import { Modal, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  SquircleView,
  squircleSmoothing,
} from '@/components/ui/squircle-view';
import { WalletPickerContent } from './wallet-picker-content';
import type { WalletPickerItem } from './wallet-picker-content';
import { walletPickerSheetHeight } from './wallet-picker-sheet-height';

type WalletPickerModalProps = {
  visible: boolean;
  wallets: WalletPickerItem[];
  selectedId?: string | null;
  title?: string;
  subtitle?: string;
  onSelect: (wallet: WalletPickerItem) => void;
  onClose: () => void;
};

/** Non-Android fallback for the native Android wallet bottom sheet. */
export function WalletPickerModal({
  visible,
  onClose,
  wallets,
  ...props
}: WalletPickerModalProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight =
    walletPickerSheetHeight(wallets.length, windowHeight) +
    Math.max(insets.bottom, 12);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View className="flex-1 justify-end bg-black/40">
        <SquircleView
          className="overflow-hidden rounded-[28px] bg-canvas"
          cornerSmoothing={squircleSmoothing.hero}
          style={{ height: sheetHeight }}
        >
          <View
            className="px-5 pb-3 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <View className="mb-3 h-1.5 w-10 self-center rounded-full bg-border" />
            <WalletPickerContent
              {...props}
              wallets={wallets}
              onClose={onClose}
            />
          </View>
        </SquircleView>
      </View>
    </Modal>
  );
}
