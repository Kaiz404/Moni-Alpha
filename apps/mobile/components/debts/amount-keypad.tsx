import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { keypadTap } from '@/lib/haptics';
import { tid } from '@/lib/test-ids';

import {
  KEYPAD_ROWS,
  typeKey,
} from '@/components/debts/typed-amount';

/** The Paper keypad of the amount page; digits fire Keyboard_Tap. */
export function AmountKeypad({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const tokens = useThemeTokens();
  return (
    <View className="gap-2">
      {KEYPAD_ROWS.map((row) => (
        <View
          key={row.join('')}
          className="flex-row gap-2"
        >
          {row.map((key) => (
            <Press
              key={key}
              testID={tid('debts', 'key', key)}
              accessibilityLabel={
                key === 'back'
                  ? 'Delete'
                  : key === '.'
                    ? 'Point'
                    : key
              }
              radius={{ rest: 16, pressed: 12 }}
              className="h-14 flex-1 items-center justify-center bg-card"
              onPress={() => {
                keypadTap();
                onChange(typeKey(value, key));
              }}
            >
              {key === 'back' ? (
                <IconSymbol
                  name="backspace-outline"
                  size={24}
                  color={tokens.foreground}
                />
              ) : (
                <Text className="text-[24px] leading-[28px] font-display-semibold text-foreground">
                  {key}
                </Text>
              )}
            </Press>
          ))}
        </View>
      ))}
    </View>
  );
}
