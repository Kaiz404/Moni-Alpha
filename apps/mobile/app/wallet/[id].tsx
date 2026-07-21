import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  decimalToMinor,
  type MinorAmount,
  updateWalletSchema,
} from '@repo/types';

import { AmountInput } from '@/components/finance/amount-input';
import { CurrencyPickerModal } from '@/components/finance/currency-picker-modal';
import { BrandHeader } from '@/components/ui/brand-header';
import { FeedbackState } from '@/components/ui/feedback-state';
import { FormField } from '@/components/ui/form-field';
import { IconAction } from '@/components/ui/icon-action';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenShell } from '@/components/ui/screen-shell';
import { Surface } from '@/components/ui/surface';
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
import { formatTimeAgo } from '@/lib/dates/relative-time';
import { minorToDecimal } from '@/lib/finance/money';
import { createTransaction } from '@/lib/supabase/transactions';
import {
  deleteWallet,
  getWalletById,
  getWallets,
  updateWallet,
} from '@/lib/supabase/wallets';

export default function EditWalletScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const tokens = useThemeTokens();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const walletId = useMemo(() => {
    const value = params.id;
    return Array.isArray(value) ? value[0] : value;
  }, [params.id]);

  const [loadingWallet, setLoadingWallet] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<WalletKind>('bank');
  const [currency, setCurrency] = useState('USD');
  const [currentBalance, setCurrentBalance] = useState('');
  const [currentBalanceMinor, setCurrentBalanceMinor] =
    useState<MinorAmount>(0 as MinorAmount);
  const [currencyPickerVisible, setCurrencyPickerVisible] =
    useState(false);
  const [cardStyleId, setCardStyleId] = useState(
    DEFAULT_WALLET_CARD_STYLE_ID,
  );
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [readOnlyUpdated, setReadOnlyUpdated] = useState('');
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
    if (!user || !walletId) return;
    let cancelled = false;

    void (async () => {
      setLoadingWallet(true);
      setLoadError(null);
      try {
        const wallet = await getWalletById(walletId);
        if (cancelled) return;
        if (!wallet) {
          setLoadError('This wallet is no longer available.');
          return;
        }
        setName(wallet.name ?? '');
        setType(
          WALLET_TYPE_OPTIONS.find(
            (option) => option.value === wallet.type,
          )?.value ?? 'bank',
        );
        setCurrency(wallet.currency ?? 'USD');
        setCurrentBalance(minorToDecimal(wallet.currentBalanceMinor));
        setCurrentBalanceMinor(wallet.currentBalanceMinor);
        setCardStyleId(
          wallet.cardStyleId || DEFAULT_WALLET_CARD_STYLE_ID,
        );
        setReadOnlyUpdated(
          formatTimeAgo(wallet.updatedAt, {
            fallback: 'Not available',
          }),
        );
        setNotificationLink({
          notificationPackage: wallet.notificationPackage ?? null,
          notificationAppLabel: wallet.notificationAppLabel ?? null,
          notificationAccountHint:
            wallet.notificationAccountHint ?? null,
        });
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Could not load this wallet.',
          );
        }
      } finally {
        if (!cancelled) setLoadingWallet(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, walletId]);

  useEffect(() => {
    if (!user || !walletId) return;
    setSharedPackageWalletNames([]);
    if (!notificationLink.notificationPackage) return;

    let cancelled = false;
    void getWallets().then((wallets) => {
      if (cancelled) return;
      setSharedPackageWalletNames(
        wallets
          .filter(
            (wallet) =>
              wallet.id !== walletId &&
              wallet.notificationPackage ===
                notificationLink.notificationPackage,
          )
          .map((wallet) => wallet.name),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [notificationLink.notificationPackage, user, walletId]);

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

  const handleDelete = useCallback(() => {
    if (!walletId) return;
    Alert.alert(
      'Delete wallet?',
      'This permanently deletes this wallet and its related transactions. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete wallet',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWallet(walletId);
              router.replace('/(tabs)' as never);
            } catch (error) {
              Alert.alert(
                'Could not delete wallet',
                error instanceof Error
                  ? error.message
                  : 'Please try again.',
              );
            }
          },
        },
      ],
    );
  }, [walletId]);

  const handleSubmit = useCallback(async () => {
    if (!user || !walletId) return;
    let targetBalanceMinor: MinorAmount;
    try {
      targetBalanceMinor = decimalToMinor(
        currentBalance.trim().replace(/,/g, '') || '0',
      );
    } catch {
      Alert.alert(
        'Check this wallet',
        'Enter a valid current balance.',
      );
      return;
    }

    const style =
      WALLET_CARD_STYLES.find((item) => item.id === cardStyleId) ??
      WALLET_CARD_STYLES[0];
    const parsed = updateWalletSchema.safeParse({
      name: name.trim(),
      type,
      currency: currency.trim().toUpperCase().slice(0, 3) || 'USD',
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

    setSaving(true);
    try {
      await updateWallet(walletId, parsed.data);
      const differenceMinor = Math.abs(
        Number(targetBalanceMinor) - Number(currentBalanceMinor),
      ) as MinorAmount;
      if (differenceMinor > 0) {
        await createTransaction({
          walletId,
          amountMinor: differenceMinor,
          type:
            targetBalanceMinor > currentBalanceMinor
              ? 'income'
              : 'expense',
          categoryId: null,
          merchant: null,
          description: 'Balance adjustment',
          notes: 'Created while updating the wallet balance.',
          analysisExcluded: true,
          transactionDate: new Date().toISOString(),
        });
      }
      router.back();
    } catch (error) {
      Alert.alert(
        'Could not save wallet',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }, [
    cardStyleId,
    currentBalance,
    currentBalanceMinor,
    currency,
    name,
    notificationLink,
    type,
    user,
    walletId,
  ]);

  if (!walletId) {
    return (
      <ScreenShell variant="canvas">
        <BrandHeader title="Wallet" />
        <FeedbackState
          className="flex-1"
          description="Return to Accounts and choose a wallet to edit."
          icon="wallet"
          title="Missing wallet"
        />
      </ScreenShell>
    );
  }

  if (loadingWallet) {
    return (
      <ScreenShell variant="canvas">
        <BrandHeader title="Wallet" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            color={tokens.primary}
            size="large"
          />
          <Text className="mt-3 text-sm text-muted">
            Loading wallet…
          </Text>
        </View>
      </ScreenShell>
    );
  }

  if (loadError) {
    return (
      <ScreenShell variant="canvas">
        <BrandHeader title="Wallet" />
        <FeedbackState
          className="flex-1"
          description={loadError}
          icon="alert-circle-outline"
          mode="error"
          title="Couldn’t open this wallet"
        />
        <View className="px-5 pb-5">
          <PrimaryButton
            label="Go back"
            onPress={() => router.back()}
          />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell variant="canvas">
      <BrandHeader
        title="Edit wallet"
        rightAction={
          <IconAction
            accessibilityLabel="Delete wallet"
            icon="trash-can-outline"
            onPress={handleDelete}
            tone="danger"
          />
        }
      />
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
            <Surface>
              <Text className="mb-2 text-base font-semibold text-foreground">
                Current balance
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
              <Text className="mt-2 text-xs leading-4 text-muted">
                Saving records the difference as a balance adjustment.{' '}
                {'\n'}
                Updated {readOnlyUpdated}
              </Text>
            </Surface>

            <Surface className="mt-6">
              <View className="flex-row gap-3">
                <FormField
                  containerClassName="mb-0 min-w-0 flex-1"
                  label="Wallet name"
                  placeholder="e.g. Everyday bank"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
                <View style={{ width: 130 }}>
                  <Text className="mb-2 text-base font-semibold text-foreground">
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
                      className="ml-2 min-w-0 flex-1 text-xs font-semibold text-foreground"
                      numberOfLines={1}
                    >
                      {selectedType.label}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Surface>

            <Text className="mt-8 text-base font-bold text-foreground">
              Color
            </Text>
            <Surface
              tone="muted"
              className="mt-3"
            >
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
                <Text className="flex-1 text-sm font-semibold text-foreground">
                  {selectedCardStyle.label}
                </Text>
                <Text className="text-sm font-semibold text-primary">
                  Change
                </Text>
              </TouchableOpacity>
            </Surface>

            <Text className="mt-8 text-base font-bold text-foreground">
              Notification link
            </Text>
            <Text className="mb-3 mt-1 text-sm leading-5 text-muted">
              Link an app so possible transactions can be
              automatically routed to this wallet.
            </Text>
            <Surface tone="muted">
              <WalletNotificationLinkSection
                value={notificationLink}
                onChange={handleNotificationLinkChange}
                sharedPackageWalletNames={sharedPackageWalletNames}
              />
            </Surface>
          </ScrollView>

          <View
            className="border-t border-border-subtle bg-canvas px-5 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <PrimaryButton
              label="Save changes"
              loading={saving}
              loadingLabel="Saving wallet…"
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
    </ScreenShell>
  );
}
