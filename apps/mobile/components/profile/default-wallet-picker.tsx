import { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getWallets } from '@/lib/supabase/wallets';
import {
  getDefaultWalletId,
  setDefaultWalletId,
  syncDefaultWalletFromProfile,
} from '@/lib/wallets/default-wallet';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

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
      const [ws, stored] = await Promise.all([getWallets(), syncDefaultWalletFromProfile()]);
      setWallets(
        ws.map((w) => ({
          id: w.id,
          name: w.name ?? 'Wallet',
          type: w.type ?? 'other',
          currency: w.currency ?? 'USD',
        })),
      );
      setSelectedId(stored && ws.some((w) => w.id === stored) ? stored : null);
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
      setSelectedId(cached && ws.some((w) => w.id === cached) ? cached : null);
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
      Alert.alert('Could not save', 'Failed to update your default wallet. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="mb-2 items-center justify-center rounded-xl border border-border bg-card py-6">
        <ActivityIndicator color={tokens.primary} />
      </View>
    );
  }

  if (wallets.length === 0) {
    return (
      <View className="mb-2 rounded-xl border border-border bg-card px-3.5 py-3">
        <Text className="text-sm text-muted">Add a wallet first to set a default.</Text>
      </View>
    );
  }

  const options: { id: string | null; label: string; subtitle: string }[] = [
    { id: null, label: 'None', subtitle: 'AI will leave wallet unset when it cannot infer one' },
    ...wallets.map((w) => ({
      id: w.id,
      label: w.name,
      subtitle: `${w.type} · ${w.currency}`,
    })),
  ];

  return (
    <View className="mb-2 overflow-hidden rounded-xl border border-border bg-card">
      {options.map((option, index) => {
        const selected = selectedId === option.id;
        return (
          <Pressable
            key={option.id ?? 'none'}
            onPress={() => select(option.id)}
            disabled={saving}
            className={`flex-row items-center px-3.5 py-3 active:opacity-90 ${
              index > 0 ? 'border-t border-border' : ''
            } ${saving ? 'opacity-70' : ''}`}>
            <View className="flex-1 min-w-0 pr-3">
              <Text className="text-base font-semibold text-foreground">{option.label}</Text>
              <Text className="mt-0.5 text-xs text-muted">{option.subtitle}</Text>
            </View>
            <View
              className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
                selected ? 'border-primary bg-primary' : 'border-border bg-card'
              }`}>
              {selected ? <View className="h-2 w-2 rounded-full bg-primary-foreground" /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
