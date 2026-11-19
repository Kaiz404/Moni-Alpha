import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { MinorAmount } from '@repo/types';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { WalletIcon } from '@/components/wallets/wallet-icon';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { minorToNumber } from '@/lib/finance/money';
import { openSheet } from '@/lib/sheet/sheet-store';
import {
  createBalanceCorrection,
  deleteTransaction,
} from '@/lib/supabase/transactions';
import { confirmWalletBalance } from '@/lib/supabase/wallets';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import { correctBalance } from '@repo/core';
import type { WalletAlertLink } from '@/lib/wallets/wallet-link';
import { walletMeta } from '@/lib/wallets/wallet-meta';
import { type FinanceWallet, formatMoney, formatSignedMoney } from '@repo/core';

/**
 * Asks for the real balance in the balance sheet. A different balance writes one balance
 * correction and shows the toast with Undo; the same balance only marks it checked.
 */
async function correctWalletBalance(wallet: FinanceWallet, balanceMinor: MinorAmount) {
  const typed = await openSheet({
    kind: 'balance',
    currency: wallet.currency,
    balanceMinor,
  });
  if (typed === null) return;
  const previousCheck = wallet.balanceConfirmedAt;
  confirmWalletBalance(wallet.id);
  const correction = correctBalance(
    { balance: minorToNumber(balanceMinor) },
    minorToNumber(typed),
  );
  if (!correction) {
    showToast({ text: 'Balance checked' });
    return;
  }
  try {
    const created = await createBalanceCorrection(wallet.id, correction);
    showToast({
      text: `Correction ${formatSignedMoney(correction.type, correction.amountMinor, wallet.currency)} added`,
      undo: () => {
        void deleteTransaction(created.id);
        confirmWalletBalance(wallet.id, previousCheck);
      },
    });
  } catch (error) {
    showToast({
      text: error instanceof Error ? error.message : "Couldn't save that",
      tone: 'removed',
    });
  }
}

/** V2H-WalletDetail top: the wallet's name, then its amount. The pencil opens the balance sheet. */
export function WalletHero({
  wallet,
  balanceMinor,
  link,
  openBalance,
}: {
  wallet: FinanceWallet;
  balanceMinor: MinorAmount;
  link: WalletAlertLink;
  /** Opens the balance sheet on arrival, for the Home check-in's Fix it. */
  openBalance: boolean;
}) {
  const tokens = useThemeTokens();
  const style = getWalletCardStyle(wallet.cardStyleId);
  const currency = wallet.currency;
  const correct = () => void correctWalletBalance(wallet, balanceMinor);

  const asked = useRef(false);
  useEffect(() => {
    if (!openBalance || asked.current) return;
    asked.current = true;
    correct();
  });

  const balance = formatMoney(balanceMinor, currency);
  return (
    <View className="gap-2.5">
      <View className="flex-row items-center gap-3">
        <View
          className="h-[52px] w-[52px] items-center justify-center rounded-full"
          style={{ backgroundColor: wallet.color ?? style.swatchHex }}
        >
          <WalletIcon
            color={style.contentColor}
            icon={wallet.icon}
            type={wallet.type}
            size={24}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Text
            testID={tid('wallet', 'name')}
            variant="sectionTitle"
            className="text-foreground"
            numberOfLines={1}
          >
            {wallet.name}
          </Text>
          <Text
            variant="meta"
            className="text-muted"
            numberOfLines={1}
          >
            {walletMeta(wallet.type, currency, link)}
          </Text>
        </View>
      </View>

      <Press
          testID={tid('wallet', 'balance', 'edit')}
          accessibilityLabel={`Edit amount, ${balance}`}
          pressedClassName=""
          className="flex-row items-center gap-2 self-start"
          onPress={correct}
        >
          <Text
            testID={tid('wallet', 'balance', 'amount')}
            variant="amountHero"
            className="min-w-0 flex-shrink text-foreground"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {balance}
          </Text>
          <View
            pointerEvents="none"
            className="h-8 w-8 items-center justify-center rounded-full bg-sand"
          >
            <IconSymbol
              name="pencil-outline"
              size={16}
              color={tokens.foreground}
            />
          </View>
        </Press>
    </View>
  );
}
