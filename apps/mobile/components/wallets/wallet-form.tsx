import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import {
  createWalletSchema,
  decimalToMinor,
  updateWalletSchema,
} from '@repo/types';

import { TextTile } from '@/components/amount/text-tile';
import { Button } from '@/components/ui/button';
import { FieldBubble } from '@/components/ui/field-bubble';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Page, PageActions } from '@/components/ui/page';
import {
  FieldGlyph,
  FieldText,
  PickerField,
} from '@/components/ui/picker-field';
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
import { openSheet } from '@/lib/sheet/sheet-store';
import { createWallet, updateWallet } from '@/lib/supabase/wallets';
import { tid } from '@/lib/test-ids';
import { parseBalanceInput } from '@repo/core';
import { confirmDeleteWallet } from '@/lib/wallets/delete-wallet';
import { walletMeta } from '@/lib/wallets/wallet-meta';
import {
  useWalletNamesLinkedTo,
  type WalletAlertLink,
} from '@/lib/wallets/wallet-link';
import { type FinanceWallet, currencySymbol } from '@repo/core';

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

          <TextTile
            testID={tid('wallet', 'form', 'name')}
            label="Name"
            icon="pencil-outline"
            value={values.name}
            onChangeText={(text) => set({ name: text })}
            placeholder="e.g. Everyday bank"
            maxLength={NAME_MAX}
            autoCapitalize="words"
            returnKeyType="done"
          />

          <View className="flex-row gap-2">
            <PickerField
              testID={tid('wallet', 'type')}
              className="min-w-0 flex-1"
              label="Type"
              value={type.label}
              icon="wallet-outline"
              leading={
                <FieldBubble color={tokens.card}>
                  <WalletIcon
                    color={tokens.foreground}
                    icon={type.icon}
                    size={17}
                  />
                </FieldBubble>
              }
              onPress={() => void pickType()}
            />
            {editing ? (
              <View
                accessible
                accessibilityLabel={`Currency, ${values.currency}. A wallet keeps its currency.`}
                className="h-[60px] min-w-0 flex-1 flex-row items-center gap-2.5 rounded-tile bg-sand px-2.5"
              >
                <FieldGlyph name="cash" />
                <FieldText
                  label="Currency"
                  value={values.currency}
                  trailing={
                    <IconSymbol
                      name="lock-outline"
                      size={16}
                      color={tokens.muted}
                    />
                  }
                />
              </View>
            ) : (
              <PickerField
                testID={tid('wallet', 'currency')}
                className="min-w-0 flex-1"
                label="Currency"
                value={values.currency}
                icon="cash"
                onPress={() => void pickCurrency()}
              />
            )}
          </View>

          {editing ? null : (
            <TextTile
              testID={tid('wallet', 'form', 'starting-balance')}
              label="Starting balance"
              icon="bank-outline"
              prefix={currencySymbol(values.currency)}
              value={startingBalance}
              onChangeText={(text) =>
                setStartingBalance(text.replace(/[^0-9.,]/g, ''))
              }
              placeholder="0.00"
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
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
        <PageActions>
          <Button
            testID={tid('wallet', 'form', 'submit')}
            className="flex-1"
            pinned
            label={editing ? 'Save changes' : 'Create wallet'}
            loading={saving}
            loadingLabel={editing ? 'Saving…' : 'Creating…'}
            disabled={!name}
            onPress={() => void save()}
          />
        </PageActions>
      </KeyboardAvoidingView>
    </Page>
  );
}
