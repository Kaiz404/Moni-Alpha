import { useState } from 'react';
import { View } from 'react-native';
import type { MinorAmount } from '@repo/types';

import {
  InPlaceField,
  InPlaceGroup,
  type Saved,
} from '@/components/ui/in-place-field';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { walletMeta } from '@/components/wallets/wallet-form';
import { WalletIcon } from '@/components/wallets/wallet-icon';
import { labelForNotificationPackage } from '@/constants/notification-apps';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';
import {
  currencySymbol,
  formatMoney,
  formatSignedMoney,
} from '@/lib/finance/format-money';
import { minorToNumber } from '@/lib/finance/money';
import type { FinanceWallet } from '@/lib/finance/types';
import {
  createBalanceCorrection,
  deleteTransaction,
} from '@/lib/supabase/transactions';
import {
  confirmWalletBalance,
  updateWallet,
} from '@/lib/supabase/wallets';
import { tid, type TestId } from '@/lib/test-ids';
import { correctBalance } from '@/lib/wallets/balance-correction';
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
  const [editing, setEditing] = useState<TestId | null>(
    initialEdit ? tid('wallet', initialEdit) : null,
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

  const saveName = (next: string): Saved | void => {
    const previous = wallet.name;
    if (next === previous) return;
    void updateWallet(wallet.id, { name: next });
    return {
      text: `Renamed to ${next}`,
      undo: () => void updateWallet(wallet.id, { name: previous }),
    };
  };

  const saveBalance = async (typed: MinorAmount): Promise<Saved | void> => {
    const previousCheck = wallet.balanceConfirmedAt;
    confirmWalletBalance(wallet.id);
    const correction = correctBalance(
      { balance: minorToNumber(balanceMinor) },
      minorToNumber(typed),
    );
    if (!correction) return;
    const created = await createBalanceCorrection(wallet.id, correction);
    return {
      text: `Correction ${formatSignedMoney(correction.type, correction.amountMinor, currency)} added`,
      undo: () => {
        void deleteTransaction(created.id);
        confirmWalletBalance(wallet.id, previousCheck);
      },
    };
  };

  return (
    <InPlaceGroup
      editing={editing}
      onEditingChange={setEditing}
    >
      <View className="gap-2.5">
        <InPlaceField
          testID={tid('wallet', 'name')}
          label="Wallet name"
          kind="text"
          required
          maxLength={NAME_MAX}
          autoCapitalize="words"
          value={wallet.name}
          hint="Only the name changes. Its transactions stay as they are."
          onSave={saveName}
        >
          {({ editable, editor }) =>
            editor ?? (
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
                  {editable(
                    <Text
                      variant="sectionTitle"
                      className="text-foreground"
                      numberOfLines={1}
                    >
                      {wallet.name}
                    </Text>,
                    { accessibilityLabel: `Rename ${wallet.name}` },
                  )}
                  <Text
                    variant="meta"
                    className="text-muted"
                    numberOfLines={1}
                  >
                    {walletMeta(wallet.type, currency, link)}
                  </Text>
                </View>
              </View>
            )
          }
        </InPlaceField>

        <InPlaceField
          testID={tid('wallet', 'balance')}
          label="Balance"
          kind="amount"
          prefix={currencySymbol(currency)}
          signed
          value={balanceMinor}
          hint={(typed) =>
            balanceDiffLine(
              balanceMinor,
              currency,
              typed === null ? null : minorToNumber(typed),
              source,
            )
          }
          onSave={saveBalance}
        >
          {({ editable, editor, open }) => (
            <View className={editor ? 'gap-1.5' : 'gap-0.5'}>
              <Text
                variant="caps"
                className="text-muted"
              >
                Balance
              </Text>
              {editor ?? (
                <>
                  {editable(
                    <Text
                      variant="amountHero"
                      className="text-foreground"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={{ fontVariant: ['tabular-nums'] }}
                    >
                      {formatMoney(balanceMinor, currency)}
                    </Text>,
                    {
                      accessibilityLabel: `Balance ${formatMoney(balanceMinor, currency)}. Edit balance`,
                    },
                  )}
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
                      disabled={editing !== null}
                      onPress={open}
                    >
                      <Text className="font-display-bold text-[13px] leading-[18px] text-deep-mint">
                        Balance not right?
                      </Text>
                    </Press>
                  </View>
                </>
              )}
            </View>
          )}
        </InPlaceField>
      </View>
    </InPlaceGroup>
  );
}
