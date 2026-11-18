import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import {
  createWalletSchema,
  decimalToMinor,
  updateWalletSchema,
} from '@repo/types';

import { Button } from '@/components/ui/button';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Page } from '@/components/ui/page';
import { PickerField } from '@/components/ui/picker-field';
import { Text } from '@/components/ui/text';
import { WalletColourSwatches } from '@/components/wallets/wallet-colour-swatches';
import { WalletIcon } from '@/components/wallets/wallet-icon';
import { WalletNotificationLinkSection } from '@/components/wallets/wallet-notification-link-section';
import { WalletAlerts, WalletDefault } from '@/components/wallets/wallet-sections';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';
import {
  getWalletTypeIcon,
  WALLET_TYPE_OPTIONS,
  type WalletKind,
} from '@/constants/wallet-form';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { FinanceWallet } from '@/lib/finance/types';
import { openSheet } from '@/lib/sheet/sheet-store';
import { createWallet, updateWallet } from '@/lib/supabase/wallets';
import { tid, type TestId } from '@/lib/test-ids';
import { parseBalanceInput } from '@/lib/wallets/balance-correction';
import { confirmDeleteWallet } from '@/lib/wallets/delete-wallet';
import { walletMeta } from '@/lib/wallets/wallet-meta';
import {
  useWalletNamesLinkedTo,
  type WalletAlertLink,
} from '@/lib/wallets/wallet-link';
import { currencySymbol } from '@repo/core';

export type WalletFormValues = {
  name: string;
  type: WalletKind;
  currency: string;
  cardStyleId: string;
  link: WalletAlertLink;
};

/**
 * Edit carries the live wallet and its alert link: its Alerts and Use as default save as they
 * change, so Save changes writes only the name, type and colour.
 */
export type WalletFormMode =
  | { kind: 'new' }
  | {
      kind: 'edit';
      wallet: FinanceWallet;
      link: WalletAlertLink;
      transactionCount: number;
    };

const NAME_MAX = 30;
const NO_LINK: WalletAlertLink = {
  notificationPackage: null,
  notificationAppLabel: null,
  notificationAccountHint: null,
};

export function newWalletValues(currency: string): WalletFormValues {
  return {
    name: '',
    type: 'bank',
    currency,
    cardStyleId: 'violet-dusk',
    link: NO_LINK,
  };
}

function typeOption(type: WalletKind) {
  return (
    WALLET_TYPE_OPTIONS.find((option) => option.value === type) ??
    WALLET_TYPE_OPTIONS[0]
  );
}

/** V2H-WalletForm: one form for New wallet and Edit wallet. */
export function WalletForm({
  mode,
  initial,
}: {
  mode: WalletFormMode;
  initial: WalletFormValues;
}) {
  const tokens = useThemeTokens();
  const editing = mode.kind === 'edit';
  const [values, setValues] = useState(initial);
  const [startingBalance, setStartingBalance] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<WalletFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  const link = mode.kind === 'edit' ? mode.link : values.link;
  const sharedWith = useWalletNamesLinkedTo(values.link.notificationPackage, null);
  const style = getWalletCardStyle(values.cardStyleId);
  const type = typeOption(values.type);
  const name = values.name.trim();

  const pickType = async () => {
    const picked = await openSheet({
      kind: 'walletType',
      selected: values.type,
    });
    if (picked) set({ type: picked });
  };

  const pickCurrency = async () => {
    const picked = await openSheet({
      kind: 'currency',
      selected: values.currency,
    });
    if (picked) set({ currency: picked });
  };

  const fields = () => ({
    name,
    type: values.type,
    color: style.swatchHex,
    icon: getWalletTypeIcon(values.type),
    cardStyleId: style.id,
  });

  const save = async () => {
    if (mode.kind === 'new') {
      const balance = parseBalanceInput(startingBalance || '0');
      if (balance === null || balance < 0) {
        Alert.alert(
          'Check the starting balance',
          'Type an amount of zero or more, such as 120.50.',
        );
        return;
      }
      const parsed = createWalletSchema.safeParse({
        ...fields(),
        ...values.link,
        currency: values.currency,
        initialBalanceMinor: decimalToMinor(balance),
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
        await createWallet(parsed.data);
        router.back();
      } catch (error) {
        setSaving(false);
        Alert.alert(
          'Could not create wallet',
          error instanceof Error
            ? error.message
            : 'Please try again.',
        );
      }
      return;
    }
    const parsed = updateWalletSchema.safeParse(fields());
    if (!parsed.success) {
      Alert.alert(
        'Check this wallet',
        parsed.error.errors[0]?.message ?? 'Enter a valid wallet.',
      );
      return;
    }
    setSaving(true);
    try {
      await updateWallet(mode.wallet.id, parsed.data);
      router.back();
    } catch (error) {
      setSaving(false);
      Alert.alert(
        'Could not save wallet',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  const remove = async () => {
    if (mode.kind !== 'edit') return;
    const deleted = await confirmDeleteWallet(
      mode.wallet,
      mode.transactionCount,
    );
    if (deleted) router.back();
  };

  return (
    <Page
      screen="wallet"
      kind="pushed"
      title={editing ? 'Edit wallet' : 'New wallet'}
      trailing={
        editing ? (
          <HeaderIconButton
            testID={tid('wallet', 'form', 'delete')}
            icon="trash-can-outline"
            accessibilityLabel={`Delete ${initial.name}`}
            onPress={() => void remove()}
          />
        ) : undefined
      }
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-2.5 px-5 pb-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row items-center gap-3 pb-1">
            <View
              className="h-[52px] w-[52px] items-center justify-center rounded-full"
              style={{ backgroundColor: style.swatchHex }}
            >
              <WalletIcon
                color={style.contentColor}
                icon={type.icon}
                size={24}
              />
            </View>
            <View className="min-w-0 flex-1">
              <Text
                variant="sectionTitle"
                className={name ? 'text-foreground' : 'text-muted'}
                numberOfLines={1}
              >
                {name || 'New wallet'}
              </Text>
              <Text
                variant="meta"
                className="text-muted"
                numberOfLines={1}
              >
                {walletMeta(values.type, values.currency, link)}
              </Text>
            </View>
          </View>

          <PaperField label="Name">
            <PaperInput
              testID={tid('wallet', 'form', 'name')}
              accessibilityLabel="Name"
              value={values.name}
              onChangeText={(text) => set({ name: text })}
              placeholder="e.g. Everyday bank"
              maxLength={NAME_MAX}
              autoCapitalize="words"
              returnKeyType="done"
            />
          </PaperField>

          <View className="flex-row gap-2">
            <PickerField
              testID={tid('wallet', 'type')}
              className="min-w-0 flex-1"
              label="Type"
              fill="paper"
              value={type.label}
              mark={
                <WalletIcon
                  color={tokens.foreground}
                  icon={type.icon}
                  size={18}
                />
              }
              onPress={() => void pickType()}
            />
            {editing ? (
              <View
                accessible
                accessibilityLabel={`Currency, ${values.currency}. A wallet keeps its currency.`}
                className="h-16 min-w-0 flex-1 justify-center rounded-field bg-card px-3.5"
              >
                <Text className="text-[13px] leading-[18px] text-muted">
                  Currency
                </Text>
                <View className="flex-row items-center gap-1.5">
                  <Text className="min-w-0 flex-1 text-base leading-[22px] font-display-semibold text-foreground">
                    {values.currency}
                  </Text>
                  <IconSymbol
                    name="lock-outline"
                    size={16}
                    color={tokens.muted}
                  />
                </View>
              </View>
            ) : (
              <PickerField
                testID={tid('wallet', 'currency')}
                className="min-w-0 flex-1"
                label="Currency"
                fill="paper"
                value={values.currency}
                onPress={() => void pickCurrency()}
              />
            )}
          </View>

          {editing ? null : (
            <PaperField label="Starting balance">
              <View className="flex-row items-center">
                <Text className="text-base leading-[22px] font-display-semibold text-muted">
                  {currencySymbol(values.currency)}
                </Text>
                <PaperInput
                  testID={tid('wallet', 'form', 'starting-balance')}
                  accessibilityLabel={`Starting balance in ${values.currency}`}
                  value={startingBalance}
                  onChangeText={(text) =>
                    setStartingBalance(text.replace(/[^0-9.,]/g, ''))
                  }
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
            </PaperField>
          )}

          {mode.kind === 'new' ? (
            <WalletNotificationLinkSection
              value={values.link}
              onChange={(next) => set({ link: next })}
              sharedPackageWalletNames={sharedWith}
            />
          ) : null}

          <View className="min-h-[52px] justify-center px-1">
            <WalletColourSwatches
              value={values.cardStyleId}
              onChange={(cardStyleId) => set({ cardStyleId })}
            />
          </View>

          {mode.kind === 'edit' ? (
            <>
              <WalletAlerts
                wallet={mode.wallet}
                link={mode.link}
              />
              <View className="pt-2">
                <WalletDefault wallet={mode.wallet} />
              </View>
            </>
          ) : null}

          {editing ? (
            <View className="flex-row gap-2 px-1">
              <IconSymbol
                name="information-outline"
                size={16}
                color={tokens.muted}
              />
              <Text
                variant="meta"
                className="min-w-0 flex-1 text-ink-2"
              >
                To fix the balance, tap the pencil beside the amount.
                Moni adds a correction so your history still adds up.
              </Text>
            </View>
          ) : null}
        </ScrollView>
        <View className="px-5 pb-5 pt-2">
          <Button
            testID={tid('wallet', 'form', 'submit')}
            pinned
            label={editing ? 'Save changes' : 'Create wallet'}
            loading={saving}
            loadingLabel={editing ? 'Saving…' : 'Creating…'}
            disabled={!name}
            onPress={() => void save()}
          />
        </View>
      </KeyboardAvoidingView>
    </Page>
  );
}

/** V2H-WalletForm's field in Paper rather than the board's Sand: label 13 Meta over a 16/600 value, radius 16. */
function PaperField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View className="min-h-16 justify-center rounded-field bg-card px-3.5 py-2">
      <Text className="text-[13px] leading-[18px] text-muted">
        {label}
      </Text>
      {children}
    </View>
  );
}

function PaperInput({
  testID,
  ...props
}: Omit<TextInputProps, 'testID'> & { testID: TestId }) {
  const tokens = useThemeTokens();
  return (
    <TextInput
      {...props}
      testID={testID}
      placeholderTextColor={tokens.muted}
      className="min-w-0 flex-1 p-0 font-display-semibold text-base leading-[22px] text-foreground"
    />
  );
}
