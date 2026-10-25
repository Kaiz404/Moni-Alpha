import { TextInput, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid, type TestId } from '@/lib/test-ids';

/**
 * The 52 Paper capsule search field (the picker sheets, past days): magnify, the system
 * keyboard, and a clear button `<testID>.clear` once there is text. `compact` is
 * Activity's 48 field with 16 before the glyph (V2A-Activity).
 */
export function SearchField({
  testID,
  accessibilityLabel,
  placeholder,
  value,
  onChangeText,
  compact = false,
}: {
  testID: TestId;
  accessibilityLabel: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  compact?: boolean;
}) {
  const tokens = useThemeTokens();
  return (
    <View
      className={`${compact ? 'h-12 pl-4 pr-1' : 'h-[52px] pl-[18px] pr-1.5'} flex-row items-center gap-2.5 rounded-full bg-card`}
    >
      <IconSymbol
        name="magnify"
        size={20}
        color={tokens.muted}
      />
      <TextInput
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        placeholder={placeholder}
        placeholderTextColor={tokens.muted}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        className="h-full flex-1 font-display text-[15px] text-foreground"
      />
      {value ? (
        <Press
          testID={tid(testID, 'clear')}
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          pressedClassName="bg-sand"
          className="h-10 w-10 items-center justify-center rounded-full"
        >
          <IconSymbol
            name="close"
            size={18}
            color={tokens.muted}
          />
        </Press>
      ) : null}
    </View>
  );
}
