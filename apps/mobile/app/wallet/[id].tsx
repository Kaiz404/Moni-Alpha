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
import type { ColorValue } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { decimalToMinor, updateWalletSchema } from '@repo/types';

import { StartingBalanceField } from '@/components/finance/starting-balance-field';
import { BrandHeader } from '@/components/ui/brand-header';
import { chipClass, chipTextClass } from '@/components/ui/chip';
import { FeedbackState } from '@/components/ui/feedback-state';
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
import { WalletIcon } from '@/components/wallets/wallet-icon';
import {
  getWalletTypeIcon,
  WALLET_TYPE_OPTIONS,
  type WalletKind,
} from '@/constants/wallet-form';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { formatTimeAgo } from '@/lib/dates/relative-time';
import { formatMinorAmount, minorToDecimal } from '@/lib/finance/money';
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
  const [initialBalance, setInitialBalance] = useState('');
  const [cardStyleId, setCardStyleId] = useState(
    DEFAULT_WALLET_CARD_STYLE_ID,
  );
  const [saving, setSaving] = useState(false);
  const [readOnlyBalance, setReadOnlyBalance] = useState('');
  const [readOnlyUpdated, setReadOnlyUpdated] = useState('');
  const [notificationLink, setNotificationLink] =
    useState<WalletNotificationLinkValue>({
      notificationPackage: null,
      notificationAppLabel: null,
      notificationAccountHint: null,
    });
  const [sharedPackageWalletNames, setSharedPackageWalletNames] =
    useState<string[]>([]);

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
          WALLET_TYPE_OPTIONS.find((option) => option.value === wallet.type)
            ?.value ?? 'bank',
        );
        setCurrency(wallet.currency ?? 'USD');
        setInitialBalance(minorToDecimal(wallet.initialBalanceMinor));
        setCardStyleId(wallet.cardStyleId || DEFAULT_WALLET_CARD_STYLE_ID);
        setReadOnlyBalance(
          formatMinorAmount(wallet.currentBalanceMinor, wallet.currency ?? 'USD'),
        );
        setReadOnlyUpdated(
          formatTimeAgo(wallet.updatedAt, { fallback: 'Not available' }),
        );
        setNotificationLink({
          notificationPackage: wallet.notificationPackage ?? null,
          notificationAppLabel: wallet.notificationAppLabel ?? null,
          notificationAccountHint: wallet.notificationAccountHint ?? null,
        });
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : 'Could not load this wallet.',
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
    void getWallets().then((wallets) => {
      if (!notificationLink.notificationPackage) {
        setSharedPackageWalletNames([]);
        return;
      }
      setSharedPackageWalletNames(
        wallets
          .filter(
            (wallet) =>
              wallet.id !== walletId &&
              wallet.notificationPackage === notificationLink.notificationPackage,
          )
          .map((wallet) => wallet.name),
      );
    });
  }, [notificationLink.notificationPackage, user, walletId]);

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
                error instanceof Error ? error.message : 'Please try again.',
              );
            }
          },
        },
      ],
    );
  }, [walletId]);

  const handleSubmit = useCallback(async () => {
    if (!user || !walletId) return;
    const style =
      WALLET_CARD_STYLES.find((item) => item.id === cardStyleId) ??
      WALLET_CARD_STYLES[0];
    const parsed = updateWalletSchema.safeParse({
      name: name.trim(),
      type,
      currency: currency.trim().toUpperCase().slice(0, 3) || 'USD',
      initialBalanceMinor: decimalToMinor(initialBalance || '0'),
      color: style.swatchHex,
      icon: getWalletTypeIcon(type),
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

    setSaving(true);
    try {
      await updateWallet(walletId, parsed.data);
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
    currency,
    initialBalance,
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
          icon="account-balance-wallet"
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
          <ActivityIndicator color={tokens.primary} size="large" />
          <Text className="mt-3 text-sm text-muted">Loading wallet…</Text>
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
          icon="error-outline"
          mode="error"
          title="Couldn’t open this wallet"
        />
        <View className="px-5 pb-5">
          <PrimaryButton label="Go back" onPress={() => router.back()} />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell variant="canvas">
      <BrandHeader title="Edit wallet" />
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
            <Surface tone="tray" className="p-5">
              <Text className="text-sm font-semibold text-primary">
                Current balance
              </Text>
              <Text className="mt-1 text-3xl font-bold text-foreground">
                {readOnlyBalance}
              </Text>
              <Text className="mt-2 text-xs leading-4 text-muted">
                Updated {readOnlyUpdated}
              </Text>
            </Surface>

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
                  const iconColor: ColorValue = selected
                    ? tokens.primary
                    : tokens.foreground;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      activeOpacity={0.82}
                      className={`${chipClass(selected)} justify-center px-3 rounded-full`}
                      onPress={() => setType(option.value)}
                    >
                      <View className="flex-row items-center gap-1.5">
                        <WalletIcon
                          color={iconColor}
                          icon={option.icon}
                          size={16}
                        />
                        <Text
                          className={`text-sm ${chipTextClass(selected)}`}
                          numberOfLines={1}
                        >
                          {option.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <StartingBalanceField
                currency={currency}
                hint="Changing this updates how the running balance is calculated."
                onChangeValue={setInitialBalance}
                onCurrencyChange={setCurrency}
                value={initialBalance}
              />
            </Surface>

            <Text className="mb-2 mt-8 text-base font-bold text-foreground">
              Recognition
            </Text>
            <WalletCardStylePicker
              value={cardStyleId}
              onChange={setCardStyleId}
            />

            <Text className="mb-2 mt-8 text-base font-bold text-foreground">
              Notification source
            </Text>
            <Text className="mb-3 text-sm leading-5 text-muted">
              Keep possible notification transactions tied to this account for
              review. Nothing is added automatically.
            </Text>
            <WalletNotificationLinkSection
              value={notificationLink}
              onChange={setNotificationLink}
              sharedPackageWalletNames={sharedPackageWalletNames}
            />

            <View className="mt-10 border-t border-border-subtle pt-6">
              <Text className="text-base font-bold text-foreground">
                Danger zone
              </Text>
              <Text className="mt-1 text-sm leading-5 text-muted">
                Deleting a wallet also deletes the related transactions.
              </Text>
              <PrimaryButton
                className="mt-4"
                label="Delete wallet"
                variant="destructive"
                onPress={handleDelete}
              />
            </View>
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
    </ScreenShell>
  );
}
