import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  AMOUNT_KEYS,
  pressAmountKey,
  type AmountKey,
} from '@/lib/amount/amount-input';
import { keypadTap } from '@/lib/haptics';
import { tid, type Screen } from '@/lib/test-ids';

const KEY_NAMES: Record<AmountKey, string> = {
  '0': '0',
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '.': 'point',
  back: 'back',
};

const ROWS = [0, 3, 6, 9].map((start) =>
  AMOUNT_KEYS.slice(start, start + 3),
);

/**
 * The Paper keypad of V2P-AmountPage: 56 tall keys, Keyboard_Tap on each press.
 * A key that cannot change `typed` reads Inactive and does nothing.
 */
export function Keypad({
  screen,
  typed,
  onKey,
}: {
  screen: Screen;
  typed: string;
  onKey: (key: AmountKey) => void;
}) {
  const tokens = useThemeTokens();
  return (
    <View className="gap-2">
      {ROWS.map((row) => (
        <View
          key={row[0]}
          className="flex-row gap-2"
        >
          {row.map((key) => {
            const inactive =
              key !== 'back' && pressAmountKey(typed, key) === typed;
            return (
              <Press
                key={key}
                testID={tid(screen, 'key', KEY_NAMES[key])}
                accessibilityLabel={
                  key === 'back'
                    ? 'Delete last digit'
                    : key === '.'
                      ? 'Decimal point'
                      : key
                }
                accessibilityState={{ disabled: inactive }}
                disabled={inactive}
                radius={{ rest: 20, pressed: 16 }}
                pressedClassName="bg-sand"
                className="h-14 flex-1 items-center justify-center bg-card"
                onPress={() => {
                  keypadTap();
                  onKey(key);
                }}
              >
                {key === 'back' ? (
                  <IconSymbol
                    name="backspace-outline"
                    size={26}
                    color={tokens.foreground}
                  />
                ) : (
                  <Text
                    className={`text-[26px] leading-[32px] font-display-semibold ${inactive ? 'text-inactive' : 'text-foreground'}`}
                  >
                    {key}
                  </Text>
                )}
              </Press>
            );
          })}
        </View>
      ))}
    </View>
  );
}
