import type { ReactNode } from 'react';
import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TestId } from '@/lib/test-ids';

/**
 * The debt boards' Sand picker: label over one line of mark, value and an 18
 * chevron. PickerField puts its mark beside the label and a 20 chevron.
 */
export function DebtPickField({
  testID,
  label,
  value,
  mark,
  onPress,
  className,
}: {
  testID: TestId;
  label: string;
  value: string;
  mark: ReactNode;
  onPress: () => void;
  className?: string;
}) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={testID}
      accessibilityLabel={`${label}, ${value}`}
      accessibilityHint="Opens a picker"
      pressedClassName="bg-hairline"
      className={`h-16 justify-center gap-0.5 rounded-field bg-sand px-3.5 ${className ?? ''}`}
      onPress={onPress}
    >
      <Text
        className="text-[13px] leading-[18px] text-muted"
        numberOfLines={1}
      >
        {label}
      </Text>
      <View className="flex-row items-center gap-1.5">
        {mark}
        <Text
          variant="rowTitle"
          className="min-w-0 flex-1 text-foreground"
          numberOfLines={1}
        >
          {value}
        </Text>
        <IconSymbol
          name="chevron-down"
          size={18}
          color={tokens.foreground}
        />
      </View>
    </Press>
  );
}

/** The calendar mark the due-date pickers lead with. */
export function DueMark() {
  const tokens = useThemeTokens();
  return (
    <IconSymbol
      name="calendar-clock"
      size={18}
      color={tokens.foreground}
    />
  );
}
