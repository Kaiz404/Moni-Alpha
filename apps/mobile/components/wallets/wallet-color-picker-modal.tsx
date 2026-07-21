import { Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  SquircleView,
  squircleSmoothing,
} from '@/components/ui/squircle-view';
import { WalletColorPickerContent } from './wallet-color-picker-content';
import type { WalletKind } from '@/constants/wallet-form';

type WalletColorPickerModalProps = {
  visible: boolean;
  value: string;
  onChange: (id: string) => void;
  onClose: () => void;
  name: string;
  type: WalletKind;
  currency: string;
};

/** Platform fallback for the native Android color bottom sheet. */
export function WalletColorPickerModal({
  visible,
  onClose,
  ...props
}: WalletColorPickerModalProps) {
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
            className="pb-4 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="mb-4 h-1.5 w-10 self-center rounded-full bg-border" />
            <WalletColorPickerContent
              {...props}
              onClose={onClose}
            />
          </View>
        </SquircleView>
      </View>
    </Modal>
  );
}
