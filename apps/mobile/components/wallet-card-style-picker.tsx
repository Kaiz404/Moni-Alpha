import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { GradientCard } from '@/components/ui/gradient-card';
import { WALLET_CARD_STYLES } from '@/constants/wallet-card-styles';

type WalletCardStylePickerProps = {
  value: string;
  onChange: (id: string) => void;
};

/** Grid of live gradient previews for choosing a wallet's card style. */
export function WalletCardStylePicker({ value, onChange }: WalletCardStylePickerProps) {
  return (
    <View className="mb-2 flex-row flex-wrap gap-3">
      {WALLET_CARD_STYLES.map((style) => {
        const selected = style.id === value;
        return (
          <Pressable
            key={style.id}
            onPress={() => onChange(style.id)}
            accessibilityRole="button"
            accessibilityLabel={`${style.label} card style`}
            className="items-center"
            style={{ width: 76 }}>
            <GradientCard
              cardStyle={style}
              className="h-16 w-16 items-center justify-center rounded-2xl"
              style={
                selected
                  ? { borderWidth: 2.5, borderColor: '#ffffff', elevation: 4 }
                  : undefined
              }>
              {selected ? (
                <View className="rounded-full bg-black/25 p-1">
                  <MaterialIcons name="check" size={16} color="#ffffff" />
                </View>
              ) : null}
            </GradientCard>
            <Text
              className={`mt-1.5 text-[11px] ${selected ? 'font-semibold text-foreground' : 'text-muted'}`}
              numberOfLines={1}>
              {style.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
