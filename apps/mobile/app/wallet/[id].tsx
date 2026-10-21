import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  decimalToMinor,
  type MinorAmount,
  updateWalletSchema,
} from '@repo/types';

import { AmountInput } from '@/components/finance/amount-input';
import { FeedbackState } from '@/components/ui/feedback-state';
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
import { formatTimeAgo } from '@/lib/dates/relative-time';
import { minorToDecimal } from '@/lib/finance/money';
import { createBalanceCorrection } from '@/lib/supabase/transactions';
import {
  deleteWallet,
  getWalletById,
  getWallets,
  updateWallet,
} from '@/lib/supabase/wallets';
import { Button } from '@/components/ui/button';
import { tid } from '@/lib/test-ids';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { Page } from '@/components/ui/page';

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
  const [cardStyleId, setCardStyleId] = useState(
    DEFAULT_WALLET_CARD_STYLE_ID,
  );
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

  const handleDelete = useCallback(async () => {
    if (!walletId) return;
    const confirmed = await openSheet({
      kind: 'confirm',
      title: `Delete ${name.trim() || 'this wallet'}?`,
      message:
        "Its transactions go too, and your totals change. This can't be undone.",
      confirmLabel: 'Delete',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteWallet(walletId);
      router.replace('/(tabs)' as never);
    } catch (error) {
      Alert.alert(
        'Could not delete wallet',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [name, walletId]);

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
      balanceConfirmedAt: new Date().toISOString(),
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
      await createBalanceCorrection(
        walletId,
        currentBalanceMinor,
        targetBalanceMinor,
      );
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
      <Page
        screen="wallet"
        kind="pushed"
        title="Wallet"
      >
        <FeedbackState
          className="flex-1"
          icon="wallet"
          title="Missing wallet"
        />
      </Page>
    );
  }

  if (loadingWallet) {
    return (
      <Page
        screen="wallet"
        kind="pushed"
        title="Wallet"
      >
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            color={tokens.primary}
            size="large"
          />
          <Text className="mt-3 text-sm text-muted">
            Loading wallet…
          </Text>
        </View>
      </Page>
    );
  }

  if (loadError) {
    return (
      <Page
        screen="wallet"
        kind="pushed"
        title="Wallet"
      >
        <FeedbackState
          className="flex-1"
          icon="alert-circle-outline"
          mode="error"
          title="Couldn’t open this wallet"
        />
        <View className="px-5 pb-5">
          <Button
            testID={tid('wallet', 'go-back')}
            label="Go back"
            onPress={() => router.back()}
          />
        </View>
      </Page>
    );
  }

  return (
    <Page
      screen="wallet"
      kind="pushed"
      title="Edit wallet"
      trailing={
        <HeaderIconButton
          testID={tid('wallet', 'delete-wallet')}
          accessibilityLabel="Delete wallet"
          icon="trash-can-outline"
          onPress={() => void handleDelete()}
        />
      }
    >
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
            <View className="rounded-card bg-card overflow-hidden">
              <Text className="mb-2 text-base font-display-semibold text-foreground">
                Current balance
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
              <Text className="mt-2 text-xs leading-4 text-muted">
                Saving records the difference as a balance adjustment.{' '}
                {'\n'}
                Updated {readOnlyUpdated}
              </Text>
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
              testID={tid('wallet', 'save-changes')}
              label="Save changes"
              loading={saving}
              loadingLabel="Saving wallet…"
              icon="check"
              onPress={handleSubmit}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Page>
  );
}
