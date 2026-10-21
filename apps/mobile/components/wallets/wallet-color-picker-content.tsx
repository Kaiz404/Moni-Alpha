import { ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/text';
import {
  BOTTOM_SHEET_PRIMARY_ACTION_SPACE,
  BottomSheetPrimaryAction,
} from '@/components/ui/bottom-sheet-primary-action';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SolidWalletCard } from '@/components/ui/solid-wallet-card';
import {
  getWalletCardStyle,
  WALLET_CARD_STYLES,
} from '@/constants/wallet-card-styles';
import {
  resolveWalletIcon,
  type WalletKind,
} from '@/constants/wallet-form';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { tid } from '@/lib/test-ids';
import { Press } from '@/components/ui/press';

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
    <View className="flex-1 px-4">
      <View className="mb-5 flex-row items-center justify-between">
        <Text className="flex-1 pr-3 text-xl font-display-bold text-foreground">
          Color
        </Text>
        <HeaderIconButton
          testID={tid('sheet', 'close-color-picker')}
          accessibilityLabel="Close color picker"
          icon="close"
          onPress={onClose}
        />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: BOTTOM_SHEET_PRIMARY_ACTION_SPACE,
        }}
        showsVerticalScrollIndicator={false}
      >
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
            className="pr-12 text-lg font-display-bold"
            numberOfLines={1}
            style={{ color: style.contentColor }}
          >
            {previewName}
          </Text>
          <View>
            <Text
              className="text-2xl font-display-bold"
              style={{ color: style.contentColor }}
            >
              0.00 {currency.trim().toUpperCase() || 'USD'}
            </Text>
          </View>
        </SolidWalletCard>

        <Text className="mb-3 mt-6 text-sm font-display-semibold text-foreground">
          Color options
        </Text>
        <View className="flex-row flex-wrap">
          {WALLET_CARD_STYLES.map((item) => {
            const selected = item.id === value;
            return (
              <Press
                testID={tid('sheet', 'choose', item.id)}
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
                      ? 'mt-1.5 text-[11px] font-display-semibold text-foreground'
                      : 'mt-1.5 text-[11px] text-muted'
                  }
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </Press>
            );
          })}
        </View>
      </ScrollView>
      <BottomSheetPrimaryAction
        testID={tid('sheet', 'confirm')}
        horizontalInset={16}
        icon="check"
        label="Use color"
        onPress={onClose}
      />
    </View>
  );
}
