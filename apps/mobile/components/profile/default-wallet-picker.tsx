import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getWallets } from '@/lib/supabase/wallets';
import {
  getDefaultWalletId,
  setDefaultWalletId,
  syncDefaultWalletFromProfile,
} from '@/lib/wallets/default-wallet';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { Surface } from '@/components/ui/surface';

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
      <Surface className="mb-2 items-center justify-center py-6">
        <ActivityIndicator color={tokens.primary} />
      </Surface>
    );
  }

  if (wallets.length === 0) {
    return (
      <Surface className="mb-2 px-4 py-4">
        <Text className="text-sm text-muted">
          Add a wallet first to set a default.
        </Text>
      </Surface>
    );
  }

  const options: {
    id: string | null;
    label: string;
  }[] = [
    {
      id: null,
      label: 'None',
    },
    ...wallets.map((w) => ({
      id: w.id,
      label: w.name,
    })),
  ];

  return (
    <Surface className="mb-2 overflow-hidden">
      {options.map((option, index) => {
        const selected = selectedId === option.id;
        return (
          <Pressable
            key={option.id ?? 'none'}
            onPress={() => select(option.id)}
            disabled={saving}
            className={`min-h-18 flex-row items-center px-4 py-3.5 active:bg-surface-2 ${
              index > 0 ? 'border-t border-border' : ''
            } ${saving ? 'opacity-70' : ''}`}
          >
            <View className="flex-1 min-w-0 pr-3">
              <Text className="text-[17px] font-semibold text-foreground">
                {option.label}
              </Text>
            </View>
            <View
              className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
                selected
                  ? 'border-primary bg-primary'
                  : 'border-border bg-card'
              }`}
            >
              {selected ? (
                <View className="h-2 w-2 rounded-full bg-primary-foreground" />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </Surface>
  );
}
