import { useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import type { MinorAmount } from '@repo/types';

import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import {
  FieldNote,
  InPlaceField,
  Pencil,
} from '@/components/wallets/in-place-field';
import { walletMeta } from '@/components/wallets/wallet-form';
import { WalletIcon } from '@/components/wallets/wallet-icon';
import { labelForNotificationPackage } from '@/constants/notification-apps';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';
import {
  currencySymbol,
  formatMoney,
  formatSignedMoney,
} from '@/lib/finance/format-money';
import { minorToDecimal, minorToNumber } from '@/lib/finance/money';
import type { FinanceWallet } from '@/lib/finance/types';
import {
  createBalanceCorrection,
  deleteTransaction,
} from '@/lib/supabase/transactions';
import {
  confirmWalletBalance,
  updateWallet,
} from '@/lib/supabase/wallets';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import {
  correctBalance,
  parseBalanceInput,
} from '@/lib/wallets/balance-correction';
import {
  balanceDiffLine,
  checkedLabel,
  type BalanceSource,
} from '@/lib/wallets/wallet-page';
import type { WalletAlertLink } from '@/lib/wallets/wallet-link';

const NAME_MAX = 30;

export type HeroEdit = 'name' | 'balance' | null;

/**
 * V2H-WalletDetail top: the wallet's name and BALANCE, each editing in place.
 * Saving a different balance writes one balance correction and shows the
 * toast with Undo.
 */
export function WalletHero({
  wallet,
  balanceMinor,
  link,
  initialEdit,
}: {
  wallet: FinanceWallet;
  balanceMinor: MinorAmount;
  link: WalletAlertLink;
  initialEdit: HeroEdit;
}) {
  const [edit, setEdit] = useState<HeroEdit>(initialEdit);
  const [nameDraft, setNameDraft] = useState(wallet.name);
  const [balanceDraft, setBalanceDraft] = useState(() =>
    minorToDecimal(balanceMinor),
  );
  const style = getWalletCardStyle(wallet.cardStyleId);
  const currency = wallet.currency;
  const appName =
    link.notificationAppLabel ??
    (link.notificationPackage
      ? labelForNotificationPackage(link.notificationPackage)
      : null);
  const source: BalanceSource =
    wallet.type === 'cash'
      ? { kind: 'cash' }
      : { kind: 'app', name: appName ?? wallet.name };

  useEffect(() => {
    if (!edit) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setEdit(null);
        return true;
      },
    );
    return () => subscription.remove();
  }, [edit]);

  const startName = () => {
    setNameDraft(wallet.name);
    setEdit('name');
  };
  const startBalance = () => {
    setBalanceDraft(minorToDecimal(balanceMinor));
    setEdit('balance');
  };

  const saveName = () => {
    setEdit(null);
    const next = nameDraft.trim();
    const previous = wallet.name;
    if (!next || next === previous) return;
    void updateWallet(wallet.id, { name: next });
    showToast({
      text: `Renamed to ${next}`,
      undo: () => void updateWallet(wallet.id, { name: previous }),
    });
  };

  const typed = parseBalanceInput(balanceDraft);
  const saveBalance = async () => {
    if (typed === null) return;
    setEdit(null);
    const previousCheck = wallet.balanceConfirmedAt;
    confirmWalletBalance(wallet.id);
    const correction = correctBalance(
      { balance: minorToNumber(balanceMinor) },
      typed,
    );
    if (!correction) return;
    const created = await createBalanceCorrection(
      wallet.id,
      correction,
    );
    showToast({
      text: `Correction ${formatSignedMoney(correction.type, correction.amountMinor, currency)} added`,
      undo: () => {
        void deleteTransaction(created.id);
        confirmWalletBalance(wallet.id, previousCheck);
      },
    });
  };

  return (
    <View className="gap-2.5">
      {edit === 'name' ? (
        <View className="gap-1.5">
          <InPlaceField
            part="name"
            accessibilityLabel="Wallet name"
            saveLabel="Save name"
            value={nameDraft}
            onChangeText={setNameDraft}
            maxLength={NAME_MAX}
            autoCapitalize="words"
            onCancel={() => setEdit(null)}
            onSave={saveName}
          />
          <FieldNote>
            Only the name changes. Its transactions stay as they are.
          </FieldNote>
        </View>
      ) : (
        <View className="flex-row items-center gap-3">
          <View
            className="h-[52px] w-[52px] items-center justify-center rounded-full"
            style={{
              backgroundColor: wallet.color ?? style.swatchHex,
            }}
          >
            <WalletIcon
              color={style.contentColor}
              icon={wallet.icon}
              type={wallet.type}
              size={24}
            />
          </View>
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center gap-2">
              <Press
                testID={tid('wallet', 'name')}
                accessibilityLabel={`${wallet.name}. Rename`}
                pressedClassName=""
                className="min-w-0 flex-shrink"
                disabled={edit !== null}
                onPress={startName}
              >
                <Text
                  variant="sectionTitle"
                  className="text-foreground"
                  numberOfLines={1}
                >
                  {wallet.name}
                </Text>
              </Press>
              {edit === null ? (
                <Pencil
                  part="name"
                  label={`Rename ${wallet.name}`}
                  onPress={startName}
                />
              ) : null}
            </View>
            <Text
              variant="meta"
              className="text-muted"
              numberOfLines={1}
            >
              {walletMeta(wallet.type, currency, link)}
            </Text>
          </View>
        </View>
      )}

      {edit === 'balance' ? (
        <View className="gap-1.5">
          <Text
            variant="caps"
            className="text-muted"
          >
            Balance
          </Text>
          <InPlaceField
            part="balance"
            prefix={currencySymbol(currency)}
            accessibilityLabel={
              source.kind === 'cash'
                ? `Cash you have, in ${currency}`
                : `Balance your ${source.name} app shows, in ${currency}`
            }
            saveLabel="Save balance"
            keyboardType="numeric"
            value={balanceDraft}
            onChangeText={setBalanceDraft}
            onCancel={() => setEdit(null)}
            onSave={() => void saveBalance()}
          />
          <FieldNote>
            {balanceDiffLine(balanceMinor, currency, typed, source)}
          </FieldNote>
        </View>
      ) : (
        <View className="gap-0.5">
          <Text
            variant="caps"
            className="text-muted"
          >
            Balance
          </Text>
          <View className="flex-row items-center gap-2">
            <Press
              testID={tid('wallet', 'balance')}
              accessibilityLabel={`Balance ${formatMoney(balanceMinor, currency)}. Edit balance`}
              pressedClassName=""
              className="min-w-0 flex-shrink"
              disabled={edit !== null}
              onPress={startBalance}
            >
              <Text
                variant="amountHero"
                className="text-foreground"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {formatMoney(balanceMinor, currency)}
              </Text>
            </Press>
            {edit === null ? (
              <Pencil
                part="balance"
                label="Edit balance"
                onPress={startBalance}
              />
            ) : null}
          </View>
          <View className="flex-row items-center gap-1.5">
            <Text
              variant="meta"
              className="text-ink-2"
            >
              {checkedLabel(wallet.balanceConfirmedAt)}
            </Text>
            <Text
              variant="meta"
              className="text-ink-2"
              importantForAccessibility="no"
            >
              ·
            </Text>
            <Press
              testID={tid('wallet', 'balance-not-right')}
              accessibilityLabel="Balance not right? Fix it"
              pressedClassName=""
              hitSlop={13}
              disabled={edit !== null}
              onPress={startBalance}
            >
              <Text className="font-display-bold text-[13px] leading-[18px] text-deep-mint">
                Balance not right?
              </Text>
            </Press>
          </View>
        </View>
      )}
    </View>
  );
}
