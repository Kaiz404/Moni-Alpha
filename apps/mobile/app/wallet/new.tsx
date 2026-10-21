import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createWalletSchema, decimalToMinor } from '@repo/types';

import { AmountInput } from '@/components/finance/amount-input';
import { CurrencyPickerModal } from '@/components/finance/currency-picker-modal';
import { FormField } from '@/components/ui/form-field';
import { WalletColorPickerModal } from '@/components/wallets/wallet-color-picker-modal';
import { WalletTypePickerModal } from '@/components/wallets/wallet-type-picker-modal';
import {
  WalletNotificationLinkSection,
  type WalletNotificationLinkValue,
} from '@/components/wallets/wallet-notification-link-section';
import {
  DEFAULT_WALLET_CARD_STYLE_ID,
  getWalletCardStyle,
  WALLET_CARD_STYLES,
} from '@/constants/wallet-card-styles';
import { WalletIcon } from '@/components/wallets/wallet-icon';
import {
  getWalletTypeIcon,
  WALLET_TYPE_OPTIONS,
  type WalletKind,
} from '@/constants/wallet-form';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
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
  const [currencyPickerVisible, setCurrencyPickerVisible] =
    useState(false);
  const [cardStyleId, setCardStyleId] = useState(
    DEFAULT_WALLET_CARD_STYLE_ID,
  );
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notificationLink, setNotificationLink] =
    useState<WalletNotificationLinkValue>({
      notificationPackage: null,
      notificationAppLabel: null,
      notificationAccountHint: null,
    });
  const [sharedPackageWalletNames, setSharedPackageWalletNames] =
    useState<string[]>([]);
  const selectedCardStyle = useMemo(
    () => getWalletCardStyle(cardStyleId),
    [cardStyleId],
  );
  const selectedType = useMemo(
    () =>
      WALLET_TYPE_OPTIONS.find((option) => option.value === type) ??
      WALLET_TYPE_OPTIONS[0],
    [type],
  );

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
                onCurrencyPress={() => setCurrencyPickerVisible(true)}
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
                <View style={{ width: 130 }}>
                  <Text className="mb-2 text-base font-display-semibold text-foreground">
                    Account type
                  </Text>
                  <TouchableOpacity
                    accessibilityLabel="Choose account type"
                    activeOpacity={0.82}
                    className="min-h-13 flex-row items-center rounded-2xl bg-surface-2 px-3"
                    onPress={() => setTypePickerVisible(true)}
                  >
                    <WalletIcon
                      color={tokens.primary}
                      icon={selectedType.icon}
                      size={18}
                    />
                    <Text
                      className="ml-2 min-w-0 flex-1 text-xs font-display-semibold text-foreground"
                      numberOfLines={1}
                    >
                      {selectedType.label}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <Text className="mt-8 text-base font-display-bold text-foreground">
              Color
            </Text>
            <View className="rounded-card bg-sand mt-3 overflow-hidden">
              <TouchableOpacity
                accessibilityLabel="Choose wallet color"
                activeOpacity={0.82}
                className="flex-row items-center rounded-2xl px-4 py-3.5"
                onPress={() => setColorPickerVisible(true)}
              >
                <View
                  className="mr-3 h-10 w-10 rounded-xl"
                  style={{
                    backgroundColor: selectedCardStyle.swatchHex,
                  }}
                />
                <Text className="flex-1 text-sm font-display-semibold text-foreground">
                  {selectedCardStyle.label}
                </Text>
                <Text className="text-sm font-display-semibold text-primary">
                  Change
                </Text>
              </TouchableOpacity>
            </View>

            <Text className="mt-8 text-base font-display-bold text-foreground">
              Notification link
            </Text>
            <View className="rounded-card bg-sand overflow-hidden">
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
      <WalletColorPickerModal
        currency={currency}
        name={name}
        onChange={setCardStyleId}
        onClose={() => setColorPickerVisible(false)}
        type={type}
        value={cardStyleId}
        visible={colorPickerVisible}
      />
      <CurrencyPickerModal
        onClose={() => setCurrencyPickerVisible(false)}
        onSelect={setCurrency}
        selectedCode={currency}
        visible={currencyPickerVisible}
      />
      <WalletTypePickerModal
        onChange={setType}
        onClose={() => setTypePickerVisible(false)}
        value={type}
        visible={typePickerVisible}
      />
    </Page>
  );
}
