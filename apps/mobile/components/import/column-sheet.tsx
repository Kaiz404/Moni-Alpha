import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { OptionPickerSheet, type PickerOption } from '@/components/sheets/option-picker-sheet';

/** Picks the file column for one field. Mounted by the page, as its options come from the file. */
export function ColumnSheet({
  open,
  title,
  options,
  selectedId,
  onPick,
  onDismiss,
}: {
  open: boolean;
  title: string;
  options: PickerOption[];
  selectedId: string;
  onPick: (id: string) => void;
  onDismiss: () => void;
}) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });
    return () => subscription.remove();
  }, [open, onDismiss]);

  if (!mounted) return null;
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={open ? 'auto' : 'none'}
    >
      <OptionPickerSheet
        open={open}
        onDismiss={onDismiss}
        onExited={() => setMounted(false)}
        title={title}
        size="large"
        options={options}
        selectedId={selectedId}
        onPick={onPick}
      />
    </View>
  );
}
