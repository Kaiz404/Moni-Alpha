import { Text, View } from 'react-native';
import { IconAction } from '@/components/ui/icon-action';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SolidWalletCard } from '@/components/ui/solid-wallet-card';
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

      <SolidWalletCard
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
      </SolidWalletCard>

      <Text className="mb-3 mt-6 text-sm font-semibold text-foreground">
        Color options
      </Text>
      <View className="flex-row flex-wrap">
        {WALLET_CARD_STYLES.map((item) => {
          const selected = item.id === value;
          return (
            <TactilePressable
              key={item.id}
              accessibilityLabel={`Choose ${item.label} wallet color`}
              accessibilityState={{ selected }}
              className="mb-4 items-center"
              onPress={() => onChange(item.id)}
              style={{ width: '25%' }}
            >
              <View className="h-14 w-14 items-center justify-center rounded-2xl">
                <View
                  style={{
                    alignItems: 'center',
                    backgroundColor: item.backgroundColor,
                    borderRadius: 14,
                    height: 56,
                    justifyContent: 'center',
                    width: 56,
                  }}
                >
                  {selected ? (
                    <IconSymbol
                      name="check"
                      size={18}
                      color={item.contentColor}
                    />
                  ) : null}
                </View>
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
