import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createWalletSchema, decimalToMinor } from '@repo/types';

import { AmountInput } from '@/components/finance/amount-input';
import { BrandHeader } from '@/components/ui/brand-header';
import { chipClass, chipTextClass } from '@/components/ui/chip';
import { FormField } from '@/components/ui/form-field';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenShell } from '@/components/ui/screen-shell';
import { Surface } from '@/components/ui/surface';
import {
  WalletCardStylePicker,
} from '@/components/wallets/wallet-card-style-picker';
import {
  WalletNotificationLinkSection,
  type WalletNotificationLinkValue,
} from '@/components/wallets/wallet-notification-link-section';
import {
  DEFAULT_WALLET_CARD_STYLE_ID,
  WALLET_CARD_STYLES,
} from '@/constants/wallet-card-styles';
import {
  WALLET_TYPE_OPTIONS,
  type WalletKind,
} from '@/constants/wallet-form';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { createWallet, getWallets } from '@/lib/supabase/wallets';

export default function NewWalletScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const tokens = useThemeTokens();
  const [name, setName] = useState('');
  const [type, setType] = useState<WalletKind>('bank');
  const [currency, setCurrency] = useState('USD');
  const [initialBalance, setInitialBalance] = useState('');
  const [cardStyleId, setCardStyleId] = useState(
    DEFAULT_WALLET_CARD_STYLE_ID,
  );
  const [loading, setLoading] = useState(false);
  const [notificationLink, setNotificationLink] =
    useState<WalletNotificationLinkValue>({
      notificationPackage: null,
      notificationAppLabel: null,
      notificationAccountHint: null,
    });
  const [sharedPackageWalletNames, setSharedPackageWalletNames] =
    useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    void getWallets().then((wallets) => {
      if (!notificationLink.notificationPackage) {
        setSharedPackageWalletNames([]);
        return;
      }
      setSharedPackageWalletNames(
        wallets
          .filter(
            (wallet) =>
              wallet.notificationPackage ===
              notificationLink.notificationPackage,
          )
          .map((wallet) => wallet.name),
      );
    });
  }, [notificationLink.notificationPackage, user]);

  const handleSubmit = async () => {
    if (!user) return;
    const style =
      WALLET_CARD_STYLES.find((item) => item.id === cardStyleId) ??
      WALLET_CARD_STYLES[0];
    const parsed = createWalletSchema.safeParse({
      name: name.trim(),
      type,
      currency: currency.trim().toUpperCase().slice(0, 3) || 'USD',
      initialBalanceMinor: decimalToMinor(initialBalance || '0'),
      color: style.swatchHex,
      icon:
        WALLET_TYPE_OPTIONS.find((item) => item.value === type)?.icon ??
        '💰',
      cardStyleId: style.id,
      notificationPackage: notificationLink.notificationPackage,
      notificationAppLabel: notificationLink.notificationAppLabel,
      notificationAccountHint: notificationLink.notificationAccountHint,
    });
    if (!parsed.success) {
      Alert.alert(
        'Check this wallet',
        parsed.error.errors[0]?.message ?? 'Enter a valid wallet.',
      );
      return;
    }

    setLoading(true);
    try {
      await createWallet(parsed.data);
      router.back();
    } catch (error) {
      Alert.alert(
        'Could not create wallet',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenShell variant="canvas">
      <BrandHeader title="New wallet" />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1">
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-5 pb-8 pt-6"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text className="text-2xl font-bold text-foreground">
              Add an account
            </Text>
            <Text className="mt-2 max-w-md text-[15px] leading-5 text-muted">
              Keep each balance in its original currency. You can update the
              details whenever the account changes.
            </Text>

            <Surface className="mt-6 p-5">
              <FormField
                label="Wallet name"
                placeholder="e.g. Everyday bank"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />

              <Text className="mb-2 text-[15px] font-semibold text-foreground">
                Account type
              </Text>
              <View className="mb-5 flex-row flex-wrap gap-2">
                {WALLET_TYPE_OPTIONS.map((option) => {
                  const selected = type === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      activeOpacity={0.82}
                      className={`${chipClass(selected)} min-h-11 justify-center px-3`}
                      onPress={() => setType(option.value)}
                    >
                      <Text
                        className={`text-sm ${chipTextClass(selected)}`}
                        numberOfLines={1}
                      >
                        {option.icon} {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View className="flex-row gap-3">
                <FormField
                  containerClassName="flex-1"
                  label="Currency"
                  placeholder="USD"
                  value={currency}
                  onChangeText={setCurrency}
                  autoCapitalize="characters"
                  maxLength={3}
                />
                <View className="flex-1">
                  <Text className="mb-2 text-[15px] font-semibold text-foreground">
                    Starting balance
                  </Text>
                  <AmountInput
                    accessibilityLabel="Starting balance"
                    className="min-h-13 px-4 py-3 text-right text-xl font-semibold text-foreground"
                    currency={currency}
                    onChangeValue={setInitialBalance}
                    placeholder="0.00"
                    placeholderTextColor={tokens.muted}
                    value={initialBalance}
                  />
                  <Text className="mt-2 text-xs leading-4 text-muted">
                    This is not converted or combined with another currency.
                  </Text>
                </View>
              </View>
            </Surface>

            <Text className="mb-2 mt-8 text-base font-bold text-foreground">
              Recognition
            </Text>
            <Text className="mb-3 text-sm leading-5 text-muted">
              Choose a calm visual cue to make this account easy to spot.
            </Text>
            <WalletCardStylePicker
              value={cardStyleId}
              onChange={setCardStyleId}
            />

            <Text className="mb-2 mt-8 text-base font-bold text-foreground">
              Notification source
            </Text>
            <Text className="mb-3 text-sm leading-5 text-muted">
              Optional. Linking an app only helps Moni route possible
              transactions to this wallet for your review.
            </Text>
            <WalletNotificationLinkSection
              value={notificationLink}
              onChange={setNotificationLink}
              sharedPackageWalletNames={sharedPackageWalletNames}
            />
          </ScrollView>

          <View
            className="border-t border-border-subtle bg-canvas px-5 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <PrimaryButton
              label="Create wallet"
              loading={loading}
              loadingLabel="Creating wallet…"
              icon="check"
              onPress={handleSubmit}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}
