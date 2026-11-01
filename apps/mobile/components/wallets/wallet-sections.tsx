import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { addMinor, type MinorAmount } from '@repo/types';

import { reportMissedFrom } from '@/components/capture-log/report-missed';
import { LinkedAppRow } from '@/components/capture-sources/linked-app-row';
import { useCaptureHealth } from '@/components/capture-sources/use-capture-health';
import { useLinkedApps } from '@/components/capture-sources/use-linked-apps';
import { FormField } from '@/components/ui/form-field';
import { Toggle } from '@/components/ui/toggle';
import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import {
  TintBubble,
  TransactionRow,
} from '@/components/ui/transaction-row';
import { labelForNotificationPackage } from '@/constants/notification-apps';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { formatMoney } from '@/lib/finance/format-money';
import type {
  FinanceProposal,
  FinanceTransaction,
  FinanceWallet,
} from '@/lib/finance/types';
import { assessCadence } from '@/lib/notifications/capture-cadence';
import { sourceHealth, unreachedLine } from '@/lib/notifications/capture-health';
import {
  askForNotificationAccess,
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
import {
  cacheDefaultWalletId,
  getDefaultWalletId,
  setDefaultWalletId,
} from '@/lib/wallets/default-wallet';
import { useWalletNamesLinkedTo, type WalletAlertLink } from '@/lib/wallets/wallet-link';
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
  tint: 'lilac' | 'mint';
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
      <TintBubble
        icon={icon}
        color={tokens[tint]}
      />
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
          className="-mr-1.5 text-ink-2"
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
        tint="lilac"
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

/** Which other wallet an alert is for, when another wallet reads the same app. Saved on leaving the field. */
function AccountHint({
  walletId,
  hint,
  appLabel,
  sharedWith,
}: {
  walletId: string;
  hint: string | null;
  appLabel: string;
  sharedWith: string[];
}) {
  const [draft, setDraft] = useState(hint ?? '');
  return (
    <FormField
      testID={tid('wallet', 'account-hint')}
      containerClassName="px-1 pt-1"
      label="Account hint"
      hint={`${appLabel} also sends alerts for ${sharedWith.join(', ')}. A hint such as Savings or ****4521 tells Moni which wallet an alert is for.`}
      autoCapitalize="words"
      placeholder="Savings or ****4521"
      value={draft}
      onChangeText={setDraft}
      onBlur={() => {
        const next = draft.trim() || null;
        if (next === (hint?.trim() || null)) return;
        void updateWallet(walletId, { notificationAccountHint: next }).catch(couldNotSave);
      }}
    />
  );
}

function couldNotSave() {
  showToast({ text: "Couldn't save that. Try again.", tone: 'removed' });
}

/** Where a capture happened, for this wallet's alerts. */
function WalletLocation({ wallet }: { wallet: FinanceWallet }) {
  const tokens = useThemeTokens();
  const on = wallet.recordLocation !== false;
  return (
    <View className="min-h-[66px] flex-row items-center gap-3.5 px-[18px] py-3">
      <TintBubble
        icon="map-marker"
        color={tokens.sky}
      />
      <View className="min-w-0 flex-1">
        <Text
          variant="rowTitle"
          className="text-foreground"
          numberOfLines={1}
        >
          Location from notifications
        </Text>
        <Text
          variant="meta"
          className="text-muted"
          numberOfLines={1}
        >
          {on ? 'Pins each payment on the map' : 'Off for this wallet'}
        </Text>
      </View>
      <Toggle
        testID={tid('wallet', 'location')}
        accessibilityLabel={`Location from notifications for ${wallet.name}`}
        value={on}
        onChange={(next) =>
          void updateWallet(wallet.id, { recordLocation: next }).catch(couldNotSave)
        }
      />
    </View>
  );
}

/** ALERTS: the one place a wallet links an app, what that app has done lately, and the Capture log. */
export function WalletAlerts({
  wallet,
  link,
}: {
  wallet: FinanceWallet;
  link: WalletAlertLink;
}) {
  const listenerOn = useListenerOn();
  const { health, unreached } = useCaptureHealth();
  const { wallets } = useLinkedApps();
  const sharedWith = useWalletNamesLinkedTo(link.notificationPackage, wallet.id);
  const packageName = link.notificationPackage;
  const label =
    link.notificationAppLabel ??
    (packageName ? labelForNotificationPackage(packageName) : null);

  const changeApp = async () => {
    if (Platform.OS === 'android' && !listenerOn) {
      await askForNotificationAccess();
      return;
    }
    const pick = await openSheet({
      kind: 'notificationApp',
      selected: packageName,
      selectedLabel: label,
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

  const source = packageName ? sourceHealth(health, packageName) : null;

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
        {packageName && label && source ? (
          <>
            <LinkedAppRow
              testID={tid('wallet', 'alerts')}
              label={label}
              packageName={packageName}
              source={source}
              unreached={unreachedLine(unreached, packageName)}
              quiet={
                assessCadence(source, toLocalDateInput(new Date())).kind === 'quiet'
              }
              accessOff={Platform.OS === 'android' && !listenerOn}
              onChange={() => void changeApp()}
              onReportMissed={() =>
                reportMissedFrom(
                  packageName,
                  wallets.filter((linked) => linked.id === wallet.id),
                )
              }
            />
            <WalletLocation wallet={wallet} />
          </>
        ) : (
          <DetailRow
            testID={tid('wallet', 'alerts')}
            icon="bell-outline"
            tint="mint"
            title="Link an app"
            meta="Any app on this phone that sends payment alerts"
            onPress={() => void changeApp()}
          />
        )}
        <DetailRow
          testID={tid('wallet', 'capture-log')}
          icon="cellphone-message"
          tint="lilac"
          title="Capture log"
          meta="Every alert and what happened"
          onPress={() => router.push('/capture-log')}
        />
      </ListCard>
      {packageName && label && sharedWith.length > 0 ? (
        <AccountHint
          key={packageName}
          walletId={wallet.id}
          hint={link.notificationAccountHint}
          appLabel={label}
          sharedWith={sharedWith}
        />
      ) : null}
    </View>
  );
}

export function WalletDefault({ wallet }: { wallet: FinanceWallet }) {
  const tokens = useThemeTokens();
  const [isDefault, setIsDefault] = useState(() => getDefaultWalletId() === wallet.id);

  const change = async (next: boolean) => {
    const before = getDefaultWalletId();
    setIsDefault(next);
    try {
      await setDefaultWalletId(next ? wallet.id : null);
    } catch {
      cacheDefaultWalletId(before);
      setIsDefault(!next);
      showToast({ text: "Couldn't save that. Try again.", tone: 'removed' });
    }
  };

  return (
    <ListCard>
      <View className="min-h-[66px] flex-row items-center gap-3.5 px-[18px] py-3">
        <TintBubble
          icon="star-outline"
          color={tokens.lemon}
        />
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
