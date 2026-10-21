import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createWalletSchema, decimalToMinor } from '@repo/types';

import { AmountInput } from '@/components/finance/amount-input';
import { FormField } from '@/components/ui/form-field';
import { PickerField } from '@/components/ui/picker-field';
import { WalletColourSwatches } from '@/components/wallets/wallet-colour-swatches';
import {
  WalletNotificationLinkSection,
  type WalletNotificationLinkValue,
} from '@/components/wallets/wallet-notification-link-section';
import {
  DEFAULT_WALLET_CARD_STYLE_ID,
  WALLET_CARD_STYLES,
} from '@/constants/wallet-card-styles';
import { WalletIcon } from '@/components/wallets/wallet-icon';
import {
  getWalletTypeIcon,
  WALLET_TYPE_OPTIONS,
  type WalletKind,
} from '@/constants/wallet-form';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { openSheet } from '@/lib/sheet/sheet-store';
import { useAuth } from '@/lib/auth/auth-context';
import { createWallet, getWallets } from '@/lib/supabase/wallets';
import { Button } from '@/components/ui/button';
import { tid } from '@/lib/test-ids';
import { Page } from '@/components/ui/page';

export default function NewWalletScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const tokens = useThemeTokens();
  const [name, setName] = useState('');
  const [type, setType] = useState<WalletKind>('bank');
  const [currency, setCurrency] = useState('USD');
  const [currentBalance, setCurrentBalance] = useState('');
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
  const selectedType = useMemo(
    () =>
      WALLET_TYPE_OPTIONS.find((option) => option.value === type) ??
      WALLET_TYPE_OPTIONS[0],
    [type],
  );

  const pickType = async () => {
    const picked = await openSheet({
      kind: 'walletType',
      selected: type,
    });
    if (picked) setType(picked);
  };

  const pickCurrency = async () => {
    const picked = await openSheet({
      kind: 'currency',
      selected: currency,
    });
    if (picked) setCurrency(picked);
  };

  useEffect(() => {
    if (!user) return;
    setSharedPackageWalletNames([]);
    if (!notificationLink.notificationPackage) return;

    let cancelled = false;
    void getWallets().then((wallets) => {
      if (cancelled) return;
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
    return () => {
      cancelled = true;
    };
  }, [notificationLink.notificationPackage, user]);

  const handleNotificationLinkChange = useCallback(
    (next: WalletNotificationLinkValue) => {
      if (
        next.notificationPackage !==
        notificationLink.notificationPackage
      ) {
        setSharedPackageWalletNames([]);
      }
      setNotificationLink(next);
    },
    [notificationLink.notificationPackage],
  );

  const handleSubmit = async () => {
    if (!user) return;
    const style =
      WALLET_CARD_STYLES.find((item) => item.id === cardStyleId) ??
      WALLET_CARD_STYLES[0];
    const parsed = createWalletSchema.safeParse({
      name: name.trim(),
      type,
      currency: currency.trim().toUpperCase().slice(0, 3) || 'USD',
      initialBalanceMinor: decimalToMinor(
        currentBalance.trim().replace(/,/g, '') || '0',
      ),
      color: style.swatchHex,
      icon: getWalletTypeIcon(type),
      cardStyleId: style.id,
      notificationPackage: notificationLink.notificationPackage,
      notificationAppLabel: notificationLink.notificationAppLabel,
      notificationAccountHint:
        notificationLink.notificationAccountHint,
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
    <Page
      screen="wallet"
      kind="pushed"
      title="New wallet"
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1">
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-5 pb-8"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className="rounded-card bg-card mt-6 overflow-hidden">
              <Text className="mb-2 text-base font-display-semibold text-foreground">
                Starting balance
              </Text>
              <AmountInput
                accessibilityLabel="Current balance"
                className="px-0 text-right text-3xl"
                currency={currency}
                onChangeValue={setCurrentBalance}
                onCurrencyPress={() => void pickCurrency()}
                placeholder="0.00"
                value={currentBalance}
              />
            </View>

            <View className="rounded-card bg-card mt-6 overflow-hidden">
              <View className="flex-row gap-3">
                <FormField
                  testID={tid('wallet', 'wallet-name')}
                  containerClassName="mb-0 min-w-0 flex-1"
                  label="Wallet name"
                  placeholder="e.g. Everyday bank"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
                <PickerField
                  testID={tid('wallet', 'type')}
                  className="mt-7 w-36"
                  label="Type"
                  value={selectedType.label}
                  leading={
                    <WalletIcon
                      color={tokens.foreground}
                      icon={selectedType.icon}
                      size={20}
                    />
                  }
                  onPress={() => void pickType()}
                />
              </View>
            </View>

            <View className="mt-6">
              <WalletColourSwatches
                value={cardStyleId}
                onChange={setCardStyleId}
              />
            </View>

            <View className="mt-6">
              <WalletNotificationLinkSection
                value={notificationLink}
                onChange={handleNotificationLinkChange}
                sharedPackageWalletNames={sharedPackageWalletNames}
              />
            </View>
          </ScrollView>

          <View
            className="border-t border-border-subtle bg-canvas px-5 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <Button
              testID={tid('wallet', 'create-wallet')}
              label="Create wallet"
              loading={loading}
              loadingLabel="Creating wallet…"
              icon="check"
              onPress={handleSubmit}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Page>
  );
}
