import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { GradientCard } from '@/components/ui/gradient-card';
import { IconAction } from '@/components/ui/icon-action';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TactilePressable } from '@/components/ui/tactile-pressable';
import {
  getWalletCardStyle,
  WALLET_CARD_STYLES,
} from '@/constants/wallet-card-styles';
import {
  resolveWalletIcon,
  type WalletKind,
} from '@/constants/wallet-form';

type WalletColorPickerContentProps = {
  value: string;
  onChange: (id: string) => void;
  onClose: () => void;
  name: string;
  type: WalletKind;
  currency: string;
};

export function WalletColorPickerContent({
  value,
  onChange,
  onClose,
  name,
  type,
  currency,
}: WalletColorPickerContentProps) {
  const style = getWalletCardStyle(value);
  const previewName = name.trim() || 'Wallet name';

  return (
    <View className="px-4">
      <View className="mb-5 flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-xl font-bold text-foreground">
            Color
          </Text>
          <Text className="mt-1 text-sm leading-5 text-muted">
            Choose a color that makes this wallet easy to spot.
          </Text>
        </View>
        <IconAction
          accessibilityLabel="Close color picker"
          icon="close"
          onPress={onClose}
        />
      </View>

      <GradientCard
        cardStyle={style}
        className="h-44 w-full justify-between p-5"
      >
        <View
          pointerEvents="none"
          className="absolute -bottom-1 -right-3"
          style={{ opacity: 0.18 }}
        >
          <IconSymbol
            name={resolveWalletIcon(undefined, type)}
            size={78}
            color={style.contentColor}
          />
        </View>
        <Text
          className="pr-12 text-lg font-bold"
          numberOfLines={1}
          style={{ color: style.contentColor }}
        >
          {previewName}
        </Text>
        <View>
          <Text
            className="text-2xl font-bold"
            style={{ color: style.contentColor }}
          >
            0.00 {currency.trim().toUpperCase() || 'USD'}
          </Text>
        </View>
      </GradientCard>

      <Text className="mb-3 mt-6 text-sm font-semibold text-foreground">
        Color options
      </Text>
      <View className="flex-row flex-wrap gap-x-3 gap-y-4">
        {WALLET_CARD_STYLES.map((item) => {
          const selected = item.id === value;
          return (
            <TactilePressable
              key={item.id}
              accessibilityLabel={`Choose ${item.label} wallet color`}
              accessibilityState={{ selected }}
              className="items-center"
              onPress={() => onChange(item.id)}
              style={{ width: 68 }}
            >
              <View
                className="h-14 w-14 items-center justify-center rounded-2xl"
                style={
                  selected
                    ? {
                        borderWidth: 2.5,
                        borderColor: style.contentColor,
                        elevation: 4,
                        padding: 2,
                      }
                    : undefined
                }
              >
                <LinearGradient
                  colors={item.colors}
                  end={{ x: 1, y: 1 }}
                  start={{ x: 0, y: 0 }}
                  style={{
                    alignItems: 'center',
                    borderRadius: 14,
                    height: selected ? 47 : 56,
                    justifyContent: 'center',
                    width: selected ? 47 : 56,
                  }}
                >
                  {selected ? (
                    <View className="rounded-full bg-black/20 p-1">
                      <IconSymbol
                        name="check"
                        size={16}
                        color={item.contentColor}
                      />
                    </View>
                  ) : null}
                </LinearGradient>
              </View>
              <Text
                className={
                  selected
                    ? 'mt-1.5 text-[11px] font-semibold text-foreground'
                    : 'mt-1.5 text-[11px] text-muted'
                }
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TactilePressable>
          );
        })}
      </View>
    </View>
  );
}
