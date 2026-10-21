import { View } from 'react-native';

import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { WALLET_CARD_STYLES } from '@/constants/wallet-card-styles';
import { tid } from '@/lib/test-ids';

type Props = {
  value: string;
  onChange: (cardStyleId: string) => void;
};

/** V2H-WalletForm colour row: one circle per card style, the pick ringed in ink. */
export function WalletColourSwatches({ value, onChange }: Props) {
  return (
    <View className="flex-row items-center gap-3">
      <Text className="text-[13px] leading-[18px] text-muted">Colour</Text>
      <View className="flex-1 flex-row flex-wrap justify-between gap-y-2">
        {WALLET_CARD_STYLES.map((style) => {
          const selected = style.id === value;
          return (
            <Press
              key={style.id}
              testID={tid('wallet', 'colour', style.id)}
              accessibilityRole="radio"
              accessibilityLabel={style.label}
              accessibilityState={{ selected }}
              pressedClassName=""
              className="h-11 w-8 items-center justify-center"
              onPress={() => onChange(style.id)}
            >
              <View
                className={`h-8 w-8 items-center justify-center rounded-full border-2 ${selected ? 'border-foreground' : 'border-transparent'}`}
              >
                <View
                  className="h-6 w-6 rounded-full"
                  style={{ backgroundColor: style.swatchHex }}
                />
              </View>
            </Press>
          );
        })}
      </View>
    </View>
  );
}
