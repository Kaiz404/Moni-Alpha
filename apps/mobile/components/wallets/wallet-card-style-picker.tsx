import { Text, View } from 'react-native';

import { GradientCard } from '@/components/ui/gradient-card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TactilePressable } from '@/components/ui/tactile-pressable';
import { WALLET_CARD_STYLES } from '@/constants/wallet-card-styles';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

type WalletCardStylePickerProps = {
  value: string;
  onChange: (id: string) => void;
};

/** Curated wallet identities remain distinct without resembling payment cards. */
export function WalletCardStylePicker({
  value,
  onChange,
}: WalletCardStylePickerProps) {
  const tokens = useThemeTokens();

  return (
    <View className="mb-3 flex-row flex-wrap gap-3">
      {WALLET_CARD_STYLES.map((style) => {
        const selected = style.id === value;
        return (
          <TactilePressable
            key={style.id}
            onPress={() => onChange(style.id)}
            accessibilityLabel={['Choose', style.label, 'wallet style'].join(
              ' ',
            )}
            className="items-center"
            style={{ width: 76 }}
          >
            <GradientCard
              cardStyle={style}
              className="h-16 w-16 items-center justify-center rounded-2xl"
              style={
                selected
                  ? {
                      borderWidth: 2.5,
                      borderColor: tokens.card,
                      elevation: 4,
                    }
                  : undefined
              }
            >
              {selected ? (
                <View className="rounded-full bg-black/25 p-1">
                  <IconSymbol
                    name="check"
                    size={16}
                    color={tokens.primaryForeground}
                  />
                </View>
              ) : null}
            </GradientCard>
            <Text
              className={
                selected
                  ? 'mt-1.5 text-[11px] font-semibold text-foreground'
                  : 'mt-1.5 text-[11px] text-muted'
              }
              numberOfLines={1}
            >
              {style.label}
            </Text>
          </TactilePressable>
        );
      })}
    </View>
  );
}
