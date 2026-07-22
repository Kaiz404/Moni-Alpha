import { useCallback, useRef } from 'react';
import { Modal, useWindowDimensions } from 'react-native';
import {
  Column,
  Host,
  ModalBottomSheet,
  RNHostView,
} from '@expo/ui/jetpack-compose';
import type { ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import {
  height,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

import { WalletTypePickerContent } from './wallet-type-picker-content';
import type { WalletKind } from '@/constants/wallet-form';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

type WalletTypePickerModalProps = {
  visible: boolean;
  value: WalletKind;
  onChange: (value: WalletKind) => void;
  onClose: () => void;
};

export function WalletTypePickerModal({
  visible,
  onClose,
  ...props
}: WalletTypePickerModalProps) {
  const tokens = useThemeTokens();
  const { height: windowHeight } = useWindowDimensions();
  const sheetRef = useRef<ModalBottomSheetRef>(null);

  const dismiss = useCallback(async () => {
    await sheetRef.current?.hide();
    onClose();
  }, [onClose]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      {visible ? (
        <Host
          matchContents
          style={{ flex: 1 }}
        >
          <ModalBottomSheet
            containerColor={tokens.canvas}
            contentColor={tokens.foreground}
            onDismissRequest={dismiss}
            ref={sheetRef}
            skipPartiallyExpanded
          >
            <Column
              modifiers={[
                height(Math.round(windowHeight * 0.66)),
                padding(20, 12, 20, 20),
              ]}
            >
              <RNHostView modifiers={[weight(1)]}>
                <WalletTypePickerContent
                  {...props}
                  onClose={() => void dismiss()}
                />
              </RNHostView>
            </Column>
          </ModalBottomSheet>
        </Host>
      ) : null}
    </Modal>
  );
}
