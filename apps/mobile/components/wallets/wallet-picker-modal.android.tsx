import { useCallback, useRef } from 'react';
import { Modal, useWindowDimensions } from 'react-native';
import {
  Column,
  Host,
  ModalBottomSheet,
  RNHostView,
} from '@expo/ui/jetpack-compose';
import type { ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { height, padding, weight } from '@expo/ui/jetpack-compose/modifiers';

import { WalletPickerContent } from './wallet-picker-content';
import type { WalletPickerItem } from './wallet-picker-content';
import { walletPickerSheetHeight } from './wallet-picker-sheet-height';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

type WalletPickerModalProps = {
  visible: boolean;
  wallets: WalletPickerItem[];
  selectedId?: string | null;
  title?: string;
  emptyMessage?: string;
  onSelect: (wallet: WalletPickerItem) => void;
  onClose: () => void;
};

/** Android-native Expo UI bottom sheet, matching the category and wallet pickers. */
export function WalletPickerModal({
  visible,
  onClose,
  wallets,
  ...props
}: WalletPickerModalProps) {
  const tokens = useThemeTokens();
  const { height: windowHeight } = useWindowDimensions();
  const sheetRef = useRef<ModalBottomSheetRef>(null);
  const sheetHeight = walletPickerSheetHeight(
    wallets.length,
    windowHeight,
  );

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
                height(sheetHeight),
                padding(20, 12, 20, 20),
              ]}
            >
              <RNHostView modifiers={[weight(1)]}>
                <WalletPickerContent
                  {...props}
                  wallets={wallets}
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
