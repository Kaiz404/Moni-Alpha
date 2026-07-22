import { View } from 'react-native';

import { PrimaryButton } from '@/components/ui/primary-button';
import type { IconSymbolName } from '@/components/ui/icon-symbol';

/** Space reserved at the end of scrollable sheet content for the fixed action. */
export const BOTTOM_SHEET_PRIMARY_ACTION_SPACE = 92;

type BottomSheetPrimaryActionProps = {
  label: string;
  icon: IconSymbolName;
  onPress: () => void;
  disabled?: boolean;
  horizontalInset?: number;
};

/** Keeps the sheet confirmation action visible while its body scrolls. */
export function BottomSheetPrimaryAction({
  label,
  icon,
  onPress,
  disabled,
  horizontalInset = 0,
}: BottomSheetPrimaryActionProps) {
  return (
    <View className="absolute bottom-0 left-0 right-0 bg-canvas pt-3">
      <View style={{ paddingHorizontal: horizontalInset }}>
        <PrimaryButton
          disabled={disabled}
          icon={icon}
          label={label}
          onPress={onPress}
        />
      </View>
    </View>
  );
}
