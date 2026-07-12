import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth/auth-context';
import { createWallet } from '@/lib/supabase/wallets';
import { createWalletSchema } from '@repo/types';
import {
  WALLET_ACCENT_COLORS,
  WALLET_TYPE_OPTIONS,
  type WalletKind,
} from '@/constants/wallet-form';
import { BrandHeader } from '@/components/ui/brand-header';
import { ScreenShell } from '@/components/ui/screen-shell';
import { chipClass, chipTextClass } from '@/components/ui/chip';
import { PrimaryButton } from '@/components/ui/primary-button';

const inputClass =
  'rounded-xl border border-border bg-card px-3 py-2.5 text-foreground';

export default function NewWalletScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [type, setType] = useState<WalletKind>('bank');
  const [currency, setCurrency] = useState('USD');
  const [initialBalance, setInitialBalance] = useState('');
  const [color, setColor] = useState(WALLET_ACCENT_COLORS[0]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    const parsed = createWalletSchema.safeParse({
      name: name.trim(),
      type,
      currency: currency.trim().toUpperCase().slice(0, 3) || 'USD',
      initialBalance: parseFloat(initialBalance) || 0,
      color,
      icon: WALLET_TYPE_OPTIONS.find((t) => t.value === type)?.icon ?? '💰',
    });
    if (!parsed.success) {
      Alert.alert('Error', parsed.error.errors[0]?.message ?? 'Invalid input');
      return;
    }
    setLoading(true);
    try {
      await createWallet(parsed.data);
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenShell variant="canvas">
      <BrandHeader title="New Wallet" />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <View className="flex-1">
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="px-4 pt-4 pb-2"
            showsVerticalScrollIndicator={false}>
            <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Name
            </Text>
            <TextInput
              className={`mb-4 text-base ${inputClass}`}
              placeholder="Wallet name"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
            />

            <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Type
            </Text>
            <View className="mb-4 flex-row flex-wrap gap-1.5">
              {WALLET_TYPE_OPTIONS.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  className={chipClass(type === t.value)}
                  onPress={() => setType(t.value)}
                  activeOpacity={0.85}>
                  <Text className={`text-xs ${chipTextClass(type === t.value)}`} numberOfLines={1}>
                    {t.icon} {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="mb-4 flex-row gap-3">
              <View className="min-w-[100px] flex-1">
                <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  Currency
                </Text>
                <TextInput
                  className={`text-base ${inputClass}`}
                  placeholder="USD"
                  placeholderTextColor="#9CA3AF"
                  value={currency}
                  onChangeText={setCurrency}
                  autoCapitalize="characters"
                  maxLength={3}
                />
              </View>
              <View className="min-w-[120px] flex-1">
                <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  Initial balance
                </Text>
                <TextInput
                  className={`text-base ${inputClass}`}
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  value={initialBalance}
                  onChangeText={setInitialBalance}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Accent color
            </Text>
            <View className="mb-2 flex-row flex-wrap gap-2">
              {WALLET_ACCENT_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setColor(c)}
                  activeOpacity={0.85}
                  className={`h-10 w-10 items-center justify-center rounded-full ${color === c ? 'border-2 border-primary' : 'border border-border'}`}
                  style={{ backgroundColor: c }}
                  accessibilityLabel={`Color ${c}`}
                />
              ))}
            </View>
          </ScrollView>

          <View
            className="border-t border-border bg-canvas px-4 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
            <PrimaryButton
              label="Create wallet"
              loading={loading}
              loadingLabel="Creating..."
              icon="check"
              onPress={handleSubmit}
              disabled={loading}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}
