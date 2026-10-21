import { useCallback, useState } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { Text } from '@/components/ui/text';
import { useFocusEffect } from 'expo-router';
import { getWallets } from '@/lib/supabase/wallets';
import {
  getDefaultWalletId,
  setDefaultWalletId,
  syncDefaultWalletFromProfile,
} from '@/lib/wallets/default-wallet';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { PickerField } from '@/components/ui/picker-field';
import { openSheet } from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';

type WalletRow = {
  id: string;
  name: string;
  type: string;
  currency: string;
};

export function DefaultWalletPicker() {
  const tokens = useThemeTokens();
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ws, stored] = await Promise.all([
        getWallets(),
        syncDefaultWalletFromProfile(),
      ]);
      setWallets(
        ws.map((w) => ({
          id: w.id,
          name: w.name ?? 'Wallet',
          type: w.type ?? 'other',
          currency: w.currency ?? 'USD',
        })),
      );
      setSelectedId(
        stored && ws.some((w) => w.id === stored) ? stored : null,
      );
    } catch {
      const ws = await getWallets().catch(() => []);
      setWallets(
        ws.map((w) => ({
          id: w.id,
          name: w.name ?? 'Wallet',
          type: w.type ?? 'other',
          currency: w.currency ?? 'USD',
        })),
      );
      const cached = getDefaultWalletId();
      setSelectedId(
        cached && ws.some((w) => w.id === cached) ? cached : null,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const select = async (walletId: string | null) => {
    if (saving) return;
    const previous = selectedId;
    setSelectedId(walletId);
    setSaving(true);
    try {
      await setDefaultWalletId(walletId);
    } catch {
      setSelectedId(previous);
      Alert.alert(
        'Could not save',
        'Failed to update your default wallet. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="rounded-card bg-card mb-2 items-center justify-center py-6 overflow-hidden">
        <ActivityIndicator color={tokens.primary} />
      </View>
    );
  }

  if (wallets.length === 0) {
    return (
      <View className="rounded-card bg-card mb-2 px-4 py-4 overflow-hidden">
        <Text className="text-sm text-muted">
          Add a wallet first to set a default.
        </Text>
      </View>
    );
  }

  const selected = wallets.find((wallet) => wallet.id === selectedId);

  const pick = async () => {
    const choice = await openSheet({
      kind: 'wallet',
      title: 'Default wallet',
      wallets: wallets.map((wallet) => ({
        id: wallet.id,
        name: wallet.name,
        currency: wallet.currency,
        type: wallet.type,
        icon: null,
        color: null,
        cardStyleId: null,
      })),
      selectedId,
      noneLabel: 'None',
    });
    if (choice) void select(choice.walletId);
  };

  return (
    <PickerField
      testID={tid('profile', 'default-wallet')}
      className="mb-2"
      label="Default wallet"
      value={selected?.name ?? 'None'}
      disabled={saving}
      onPress={() => void pick()}
    />
  );
}
