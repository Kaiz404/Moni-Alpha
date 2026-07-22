import { Modal, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  SquircleView,
  squircleSmoothing,
} from '@/components/ui/squircle-view';
import { WalletTypePickerContent } from './wallet-type-picker-content';
import type { WalletKind } from '@/constants/wallet-form';

type WalletTypePickerModalProps = {
  visible: boolean;
  value: WalletKind;
  onChange: (value: WalletKind) => void;
  onClose: () => void;
};

/** Platform fallback for the native Android account type bottom sheet. */
export function WalletTypePickerModal({
  visible,
  onClose,
  ...props
}: WalletTypePickerModalProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View className="flex-1 justify-end bg-black/40">
        <SquircleView
          className="max-h-[82%] overflow-hidden rounded-[28px] bg-canvas"
          cornerSmoothing={squircleSmoothing.hero}
          style={{ height: Math.round(windowHeight * 0.66) }}
        >
          <View
            className="pb-4 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="mb-4 h-1.5 w-10 self-center rounded-full bg-border" />
            <WalletTypePickerContent
              {...props}
              onClose={onClose}
            />
          </View>
        </SquircleView>
      </View>
    </Modal>
  );
}
