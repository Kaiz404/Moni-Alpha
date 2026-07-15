import { FlatList, Pressable, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { router } from 'expo-router';

import { GradientCard } from '@/components/ui/gradient-card';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

type WalletItem = {
  id: string;
  name?: string;
  type?: string;
  icon?: string;
  currency?: string;
  cardStyleId?: string;
  currentBalance?: number;
  initialBalance?: number;
};

type WalletStripProps = {
  wallets: WalletItem[];
  balances: Record<string, number>;
  cardWidth: number;
  cardHeight: number;
  isAllMode: boolean;
  selectedWalletIds: Set<string>;
  onToggleWallet: (walletId: string) => void;
};

const ADD_ITEM = { id: 'add', name: 'Add Wallet', type: 'Action', icon: '+' } as const;

export function WalletStrip({
  wallets,
  balances,
  cardWidth,
  cardHeight,
  isAllMode,
  selectedWalletIds,
  onToggleWallet,
}: WalletStripProps) {
  const tokens = useThemeTokens();
  const data = [...wallets, ADD_ITEM];

  return (
    <FlatList
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      data={data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
      renderItem={({ item }) => {
        if (item.id === 'add') {
          return (
            <View
              style={{ width: cardWidth, height: cardHeight }}
              className="rounded-2xl border border-dashed border-border bg-card p-3"
            >
              <TouchableOpacity
                onPress={() => router.push('/(routes)/wallet/new' as never)}
                activeOpacity={0.85}
                className="flex-1 items-center justify-center"
              >
                <View
                  className="h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: tokens.primary }}
                >
                  <MaterialIcons name="add" size={20} color="#ffffff" />
                </View>
                <Text className="mt-2 text-xs text-muted">Add wallet</Text>
              </TouchableOpacity>
            </View>
          );
        }

        const wallet = item as WalletItem;
        const balance = balances[wallet.id] ?? wallet.currentBalance ?? wallet.initialBalance ?? 0;
        const cardStyle = getWalletCardStyle(wallet.cardStyleId);
        const isSelected = !isAllMode && selectedWalletIds.has(wallet.id);
        const currency = wallet.currency ?? 'USD';

        return (
          <View style={{ width: cardWidth, height: cardHeight }}>
            <GradientCard
              cardStyle={cardStyle}
              className="relative flex-1 rounded-2xl"
              style={
                isSelected
                  ? { borderWidth: 2, borderColor: tokens.primary }
                  : undefined
              }
            >
              <Pressable
                onPress={() => onToggleWallet(wallet.id)}
                className="flex-1 p-3"
                style={({ pressed }) => (pressed ? { opacity: 0.9 } : undefined)}
              >
                <View className="flex-row items-start justify-between">
                  <View className="h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                    <Text className="text-sm font-bold text-white">{wallet.icon ?? 'W'}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      router.push({ pathname: '/wallet/[id]', params: { id: wallet.id } })
                    }
                    hitSlop={8}
                    className="h-7 w-7 items-center justify-center rounded-full bg-white/20"
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${wallet.name ?? 'wallet'} settings`}
                  >
                    <MaterialIcons name="chevron-right" size={18} color="#ffffff" />
                  </TouchableOpacity>
                </View>

                <View className="mt-2 flex-1 justify-end">
                  <Text className="text-[10px] font-semibold uppercase tracking-wide text-white/75">
                    {wallet.type ?? 'Wallet'}
                  </Text>
                  <Text className="text-sm font-bold text-white" numberOfLines={1}>
                    {wallet.name}
                  </Text>
                  <Text className="mt-1 text-base font-bold text-white" numberOfLines={1}>
                    {currency} {balance.toFixed(2)}
                  </Text>
                </View>
              </Pressable>
              {isSelected ? (
                <View
                  pointerEvents="none"
                  className="absolute bottom-2 left-2 h-5 w-5 items-center justify-center rounded-full"
                  style={{ backgroundColor: tokens.primary }}
                >
                  <MaterialIcons name="check" size={14} color="#ffffff" />
                </View>
              ) : null}
            </GradientCard>
          </View>
        );
      }}
    />
  );
}
