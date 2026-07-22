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

import {
  TransactionDetailsSheetContent,
  type TransactionDetailsValue,
} from './transaction-details-sheet-content';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

type TransactionDetailsSheetProps = {
  visible: boolean;
  isTransfer: boolean;
  value: TransactionDetailsValue;
  locationLoading: boolean;
  locationUnavailable: boolean;
  onChange: (patch: Partial<TransactionDetailsValue>) => void;
  onClose: () => void;
};

/** Android-native Expo UI bottom sheet for optional transaction metadata. */
export function TransactionDetailsSheet({
  visible,
  onClose,
  ...props
}: TransactionDetailsSheetProps) {
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
                height(Math.round(windowHeight * 0.82)),
                padding(20, 12, 20, 20),
              ]}
            >
              <RNHostView modifiers={[weight(1)]}>
                <TransactionDetailsSheetContent
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
