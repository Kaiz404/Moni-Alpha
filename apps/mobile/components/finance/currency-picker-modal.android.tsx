import { useCallback, useMemo, useRef, useState } from 'react';
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
  imePadding,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

const SHEET_HEIGHT_FRACTION = 0.6;

import {
  CurrencyPickerHeader,
  CurrencyPickerOptionsList,
} from '@/components/finance/currency-picker-content';
import {
  filterCurrencyOptions,
  type CurrencyOption,
} from '@/constants/currencies';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

type CurrencyPickerModalProps = {
  visible: boolean;
  selectedCode: string;
  onSelect: (code: string) => void;
  onClose: () => void;
};

export function CurrencyPickerModal({
  visible,
  selectedCode,
  onSelect,
  onClose,
}: CurrencyPickerModalProps) {
  const tokens = useThemeTokens();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(
    windowHeight * SHEET_HEIGHT_FRACTION,
  );
  const sheetRef = useRef<ModalBottomSheetRef>(null);
  const [query, setQuery] = useState('');
  const normalizedSelected = selectedCode.trim().toUpperCase();

  const options = useMemo(
    () => filterCurrencyOptions(query, normalizedSelected),
    [normalizedSelected, query],
  );

  const reset = useCallback(() => {
    setQuery('');
  }, []);

  const dismiss = useCallback(async () => {
    reset();
    await sheetRef.current?.hide();
    onClose();
  }, [onClose, reset]);

  const handleSelect = useCallback(
    (option: CurrencyOption) => {
      onSelect(option.code);
    },
    [onSelect],
  );

  const handleSearchFocus = useCallback(() => {
    void sheetRef.current?.expand();
  }, []);

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
                imePadding(),
                padding(20, 12, 20, 20),
              ]}
            >
              <RNHostView matchContents>
                <CurrencyPickerHeader
                  onClose={dismiss}
                  onSearchFocus={handleSearchFocus}
                  query={query}
                  setQuery={setQuery}
                />
              </RNHostView>
              <RNHostView modifiers={[weight(1)]}>
                <CurrencyPickerOptionsList
                  nestedScrollEnabled
                  onSelect={handleSelect}
                  options={options}
                  selectedCode={selectedCode}
                />
              </RNHostView>
            </Column>
          </ModalBottomSheet>
        </Host>
      ) : null}
    </Modal>
  );
}
