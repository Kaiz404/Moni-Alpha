import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { keypadTap } from '@/lib/haptics';
import { IconSymbol } from './icon-symbol';
import { tid } from '@/lib/test-ids';

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
];

type NumericKeypadProps = {
  onKeyPress: (key: string) => void;
  /** Key height in dp; defaults to a compact 52 for dense screens. */
  keyHeight?: number;
};

/** Custom decimal keypad for amount entry (avoids popping the system keyboard). */
export function NumericKeypad({
  onKeyPress,
  keyHeight = 52,
}: NumericKeypadProps) {
  const tokens = useThemeTokens();

  const handlePress = (key: string) => {
    keypadTap();
    onKeyPress(key);
  };

  return (
    <View className="gap-2.5">
      {ROWS.map((row, rowIndex) => (
        <View
          key={rowIndex}
          className="flex-row gap-2.5"
        >
          {row.map((key) => (
            <Pressable
              testID={tid('capture', 'key', key)}
              key={key}
              onPress={() => handlePress(key)}
              accessibilityLabel={
                key === '⌫' ? 'Backspace' : `Digit ${key}`
              }
              className="flex-1 items-center justify-center rounded-full bg-surface-2 active:opacity-85"
              style={{ height: keyHeight }}
            >
              {key === '⌫' ? (
                <IconSymbol
                  name="backspace"
                  size={22}
                  color={tokens.muted}
                />
              ) : (
                <Text className="text-2xl font-display-semibold text-foreground">
                  {key}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
