import { useCallback, useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CurrencyPickerContent } from '@/components/finance/currency-picker-content';
import type { CurrencyOption } from '@/constants/currencies';
import {
  SquircleView,
  squircleSmoothing,
} from '@/components/ui/squircle-view';

type CurrencyPickerModalProps = {
  visible: boolean;
  selectedCode: string;
  onSelect: (code: string) => void;
  onClose: () => void;
};

/** RN modal fallback for platforms without Expo UI Compose sheets. */
export function CurrencyPickerModal({
  visible,
  selectedCode,
  onSelect,
  onClose,
}: CurrencyPickerModalProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [keyboardInset, setKeyboardInset] = useState(0);

  const reset = useCallback(() => {
    setQuery('');
    setKeyboardInset(0);
  }, []);

  const dismiss = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleSelect = useCallback(
    (option: CurrencyOption) => {
      onSelect(option.code);
    },
    [onSelect],
  );

  useEffect(() => {
    if (!visible) return;

    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, (event) => {
      const overlap = Math.max(
        0,
        event.endCoordinates.height - insets.bottom,
      );
      setKeyboardInset(overlap);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [insets.bottom, visible]);

  return (
    <Modal
      animationType="slide"
      onRequestClose={dismiss}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/40"
      >
        <SquircleView
          className="max-h-[85%] overflow-hidden rounded-[28px] bg-canvas"
          cornerSmoothing={squircleSmoothing.hero}
          style={{ height: Math.round(windowHeight * 0.78) }}
        >
          <View
            className="flex-1 px-5 pb-4 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <View className="mb-4 h-1.5 w-10 self-center rounded-full bg-border" />
            <CurrencyPickerContent
              keyboardInset={keyboardInset}
              onClose={dismiss}
              onSelect={handleSelect}
              query={query}
              selectedCode={selectedCode}
              setQuery={setQuery}
            />
          </View>
        </SquircleView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
