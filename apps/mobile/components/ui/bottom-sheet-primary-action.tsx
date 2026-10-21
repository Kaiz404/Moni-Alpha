import { View } from 'react-native';
import type { IconSymbolName } from '@/components/ui/icon-symbol';
import { Button } from '@/components/ui/button';
import type { TestId } from '@/lib/test-ids';

/** Space reserved at the end of scrollable sheet content for the fixed action. */
export const BOTTOM_SHEET_PRIMARY_ACTION_SPACE = 92;

type BottomSheetPrimaryActionProps = {
  testID: TestId;
  label: string;
  icon: IconSymbolName;
  onPress: () => void;
  disabled?: boolean;
  horizontalInset?: number;
};

/** Keeps the sheet confirmation action visible while its body scrolls. */
export function BottomSheetPrimaryAction({
  testID,
  label,
  icon,
  onPress,
  disabled,
  horizontalInset = 0,
}: BottomSheetPrimaryActionProps) {
  return (
    <View className="absolute bottom-0 left-0 right-0 bg-canvas pt-3">
      <View style={{ paddingHorizontal: horizontalInset }}>
        <Button
          testID={testID}
          disabled={disabled}
          icon={icon}
          label={label}
          onPress={onPress}
        />
      </View>
    </View>
  );
}
