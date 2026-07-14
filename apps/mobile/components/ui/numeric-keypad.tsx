import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
];

type NumericKeypadProps = {
  onKeyPress: (key: string) => void;
};

/** Custom decimal keypad for amount entry (avoids popping the system keyboard). */
export function NumericKeypad({ onKeyPress }: NumericKeypadProps) {
  const tokens = useThemeTokens();

  return (
    <View className="gap-3">
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} className="flex-row gap-3">
          {row.map((key) => (
            <Pressable
              key={key}
              onPress={() => onKeyPress(key)}
              accessibilityLabel={key === '⌫' ? 'Backspace' : `Digit ${key}`}
              className="flex-1 items-center justify-center rounded-2xl bg-card active:bg-background-muted"
              style={{ height: 60 }}>
              {key === '⌫' ? (
                <MaterialIcons name="backspace" size={22} color={tokens.muted} />
              ) : (
                <Text className="text-2xl font-semibold text-foreground">{key}</Text>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
