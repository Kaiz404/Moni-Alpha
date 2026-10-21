import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { addMinor, type MinorAmount } from '@repo/types';

import { Toggle } from '@/components/budget/toggle';
import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { TransactionRow } from '@/components/ui/transaction-row';
import { labelForNotificationPackage } from '@/constants/notification-apps';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatMoney } from '@/lib/finance/format-money';
import type {
  FinanceProposal,
  FinanceTransaction,
  FinanceWallet,
} from '@/lib/finance/types';
import {
  openNotificationListenerSettings,
  readNotificationListenerPermission,
} from '@/lib/notifications/permission';
import { openSheet } from '@/lib/sheet/sheet-store';
import { updateWallet } from '@/lib/supabase/wallets';
import { tid, type TestId } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import {
  transactionRow,
  type RowLookups,
} from '@/lib/transactions/row';
import { getDefaultWalletId, setDefaultWalletId } from '@/lib/wallets/default-wallet';
import type { WalletAlertLink } from '@/lib/wallets/wallet-link';
import {
  formatDayTotal,
  groupWalletDays,
} from '@/lib/wallets/wallet-page';

/** Rows shown on the wallet page; "All" opens the rest in Activity. */
const RECENT_ROWS = 10;

function DetailRow({
  testID,
  icon,
  tint,
  title,
  meta,
  value,
  onPress,
}: {
  testID: TestId;
  icon: IconSymbolName;
  tint: 'bg-lilac' | 'bg-mint';
  title: string;
  meta: string;
  value?: string;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={testID}
      accessibilityLabel={[title, meta, value]
        .filter(Boolean)
        .join(', ')}
      className="min-h-[66px] flex-row items-center gap-3.5 py-3 pl-[18px] pr-3"
      onPress={onPress}
    >
      <View
        className={`h-[42px] w-[42px] items-center justify-center rounded-full ${tint}`}
      >
        <IconSymbol
          name={icon}
          size={20}
          color={tokens.onPastel}
        />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          variant="rowTitle"
          className="text-foreground"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          variant="meta"
          className="text-muted"
          numberOfLines={1}
        >
          {meta}
        </Text>
      </View>
      {value ? (
        <Text
          variant="body"
          className="text-ink-2"
        >
          {value}
        </Text>
      ) : null}
      <IconSymbol
        name="chevron-right"
        size={20}
        color={tokens.muted}
      />
    </Press>
  );
}

/** "2 captures to review · RM109.80 isn't in this balance yet". Hidden when nothing waits. */
export function ReviewStrip({
  proposals,
  currency,
}: {
  proposals: FinanceProposal[];
  currency: string;
}) {
  const first = proposals[0];
  if (!first) return null;
  const waiting = addMinor(
    ...proposals.map(
      (proposal) => proposal.amountMinor ?? (0 as MinorAmount),
    ),
  );
  const count = proposals.length;
  return (
    <ListCard>
      <DetailRow
        testID={tid('wallet', 'review')}
        icon="bell-outline"
        tint="bg-lilac"
        title={`${count} ${count === 1 ? 'capture' : 'captures'} to review`}
        meta={`${formatMoney(waiting, currency)} isn't in this balance yet`}
        onPress={() =>
          router.push({
            pathname: '/review',
            params: { id: first.id },
          })
        }
      />
    </ListCard>
  );
}

export function WalletTransactions({
  wallet,
  transactions,
  lookups,
}: {
  wallet: FinanceWallet;
  transactions: FinanceTransaction[];
  lookups: RowLookups;
}) {
  const tokens = useThemeTokens();
  const days = useMemo(
    () => groupWalletDays(transactions.slice(0, RECENT_ROWS)),
    [transactions],
  );
  return (
    <View className="gap-2 pt-2">
      <View className="flex-row items-center justify-between">
        <Text
          variant="sectionTitle"
          className="text-foreground"
          accessibilityRole="header"
        >
          Transactions
        </Text>
        {transactions.length > 0 ? (
          <Press
            testID={tid('wallet', 'all-transactions')}
            accessibilityLabel={`All ${transactions.length} transactions in Activity`}
            pressedClassName=""
            hitSlop={8}
            className="flex-row items-center gap-0.5"
            onPress={() =>
              router.dismissTo({
                pathname: '/activity',
                params: { walletId: wallet.id },
              })
            }
          >
            <Text className="font-display-semibold text-[15px] leading-[21px] text-deep-mint">
              All {transactions.length}
            </Text>
            <IconSymbol
              name="chevron-right"
              size={18}
              color={tokens.deepMint}
            />
          </Press>
        ) : null}
      </View>
      {days.length === 0 ? (
        <Text
          variant="body"
          className="px-1 text-ink-2"
        >
          Nothing in this wallet yet. Add spending with + or tell
          Moni.
        </Text>
      ) : (
        days.map((day) => (
          <View
            key={day.key}
            className="gap-1.5"
          >
            <View className="flex-row items-baseline justify-between px-1">
              <Text
                variant="caps"
                className="text-muted"
              >
                {day.label}
              </Text>
              <Text
                className="font-display-semibold text-[13px] leading-[18px] text-ink-2"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {formatDayTotal(day.totalMinor, wallet.currency)}
              </Text>
            </View>
            <ListCard>
              {day.items.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  testID={tid('wallet', 'row', transaction.id)}
                  row={transactionRow(transaction, lookups)}
                  metaLead="category"
                  onPress={() =>
                    router.push({
                      pathname: '/transaction/[id]',
                      params: { id: transaction.id },
                    })
                  }
                />
              ))}
            </ListCard>
          </View>
        ))
      )}
    </View>
  );
}

function useListenerOn(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const read = () =>
      void readNotificationListenerPermission().then((permission) =>
        setOn(permission === 'authorized'),
      );
    read();
    const subscription = AppState.addEventListener(
      'change',
      (state) => {
        if (state === 'active') read();
      },
    );
    return () => subscription.remove();
  }, []);
  return on;
}

/** ALERTS: which app's alerts become this wallet's captures, and the Capture log. */
export function WalletAlerts({
  wallet,
  link,
}: {
  wallet: FinanceWallet;
  link: WalletAlertLink;
}) {
  const listenerOn = useListenerOn();
  const app =
    link.notificationAppLabel ??
    (link.notificationPackage
      ? labelForNotificationPackage(link.notificationPackage)
      : null);

  const changeApp = async () => {
    if (Platform.OS === 'android' && !listenerOn) {
      openNotificationListenerSettings();
      return;
    }
    const pick = await openSheet({
      kind: 'notificationApp',
      selected: link.notificationPackage,
    });
    if (!pick) return;
    await updateWallet(wallet.id, {
      notificationPackage: pick.app?.packageName ?? null,
      notificationAppLabel: pick.app?.label ?? null,
      notificationAccountHint: pick.app
        ? link.notificationAccountHint
        : null,
    });
  };

  return (
    <View className="gap-2 pt-2">
      <Text
        variant="caps"
        className="px-1 text-muted"
        accessibilityRole="header"
      >
        Alerts
      </Text>
      <ListCard>
        {wallet.type === 'cash' ? null : (
          <DetailRow
            testID={tid('wallet', 'alerts')}
            icon="bell-outline"
            tint="bg-mint"
            title={app ? `Alerts from ${app}` : 'Alerts from'}
            meta={
              app ? 'Alerts become captures' : 'Link a banking app'
            }
            value={app && listenerOn ? 'On' : 'Off'}
            onPress={() => void changeApp()}
          />
        )}
        <DetailRow
          testID={tid('wallet', 'capture-log')}
          icon="cellphone-text"
          tint="bg-lilac"
          title="Capture log"
          meta="Every alert and what happened"
          onPress={() => router.push('/capture-log')}
        />
      </ListCard>
    </View>
  );
}

/**
 * "Use as default": the wallet Moni falls back to when a capture names none. Not on
 * V2H-WalletDetail; it replaces v1 Profile's default-wallet picker, which K1 removed.
 */
export function WalletDefault({ wallet }: { wallet: FinanceWallet }) {
  const tokens = useThemeTokens();
  const [isDefault, setIsDefault] = useState(() => getDefaultWalletId() === wallet.id);

  const change = async (next: boolean) => {
    setIsDefault(next);
    try {
      await setDefaultWalletId(next ? wallet.id : null);
    } catch {
      setIsDefault(!next);
      showToast({ text: "Couldn't save that. Try again.", tone: 'removed' });
    }
  };

  return (
    <ListCard>
      <View className="min-h-[66px] flex-row items-center gap-3.5 py-3 pl-[18px] pr-3.5">
        <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-lemon">
          <IconSymbol
            name="star-outline"
            size={20}
            color={tokens.onPastel}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Text
            variant="rowTitle"
            className="text-foreground"
          >
            Use as default
          </Text>
          <Text
            variant="meta"
            className="text-muted"
          >
            For captures that name no wallet
          </Text>
        </View>
        <Toggle
          testID={tid('wallet', 'default')}
          accessibilityLabel={`Use ${wallet.name} as the default wallet`}
          value={isDefault}
          onChange={(next) => void change(next)}
        />
      </View>
    </ListCard>
  );
}
