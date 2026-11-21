import { useValue } from '@legendapp/state/react';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Button } from '@/components/ui/button';
import { Page, PageActions, PageScroll } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { NetWorthChart, netWorthLayout } from '@/components/wallets/net-worth-chart';
import { ReorderHandle, ReorderItem, useReorder } from '@/components/wallets/reorder';
import { WALLET_TINT_CLASS } from '@/components/wallets/wallet-card';
import { resolveWalletIcon } from '@/constants/wallet-form';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { financeOverview$ } from '@/lib/finance/selectors';
import { wallets$ } from '@/lib/store';
import { getRecordValues } from '@/lib/store/helpers';
import { reorderWallets } from '@/lib/supabase/wallets';
import { tid } from '@/lib/test-ids';
import {
  currencyName,
  type FinanceWallet,
  formatMoney,
  keptApartLine,
  moveWallet,
  type WalletGroup,
  walletGroups,
  walletListMeta,
  walletTint,
} from '@repo/core';
import type { MinorAmount } from '@repo/types';

const ROW = 66;
const MODE_SWAP = { enter: FadeIn.duration(180), exit: FadeOut.duration(120) };

/**
 * V2H-Wallets: every wallet, the main currency first with its balance line, others kept apart. Reorder in
 * the header turns the rows into handles, one order with Home's strip (XW-WalletCards-Reorder).
 */
export default function WalletsScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const currency = useMainCurrency();
  const overview = useValue(financeOverview$(userId));
  const linked = useValue(
    () =>
      new Set(
        getRecordValues<{
          id: string;
          deleted?: boolean;
          notification_package: string | null;
        }>(wallets$)
          .filter((wallet) => !wallet.deleted && wallet.notification_package)
          .map((wallet) => wallet.id),
      ),
  );

  const groups = useMemo(
    () => walletGroups(overview.wallets, overview.balancesByWallet, currency),
    [overview.wallets, overview.balancesByWallet, currency],
  );

  const main = groups.find((group) => group.main);
  const [now] = useState(() => new Date());
  const [reordering, setReordering] = useState(false);

  return (
    <Page
      headerScrolls
      screen="wallet"
      kind="pushed"
      title="Wallets"
      trailing={
        <>
          <HeaderIconButton
            testID={tid('wallet', 'list', 'reorder')}
            icon="swap-vertical"
            accessibilityLabel="Reorder wallets"
            active={reordering}
            onPress={() => setReordering((on) => !on)}
          />
          <HeaderIconButton
            testID={tid('wallet', 'list', 'add')}
            icon="plus"
            accessibilityLabel="Add a wallet"
            onPress={() => router.push('/wallet/new')}
          />
        </>
      }
    >
      {reordering ? (
        <>
          <PageScroll
            className="flex-1"
            contentContainerClassName="gap-3.5 px-5 pb-10"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              entering={MODE_SWAP.enter}
              exiting={MODE_SWAP.exit}
              className="gap-3.5"
            >
              {groups.map((group) => (
                <ReorderGroup
                  key={group.currency}
                  group={group}
                  balances={overview.balancesByWallet}
                  onMove={(ids) =>
                    reorderWallets(
                      groups.flatMap((other) =>
                        other === group ? ids : other.wallets.map((wallet) => wallet.id),
                      ),
                    )
                  }
                />
              ))}
            </Animated.View>
          </PageScroll>
          <PageActions>
            <Button
              testID={tid('wallet', 'list', 'reorder-done')}
              className="flex-1"
              label="Done"
              pinned
              onPress={() => setReordering(false)}
            />
          </PageActions>
        </>
      ) : (
      <PageScroll
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <NetWorthChart
          now={now}
          currency={currency}
          totalMinor={main?.totalMinor ?? 0}
          wallets={main?.wallets ?? []}
          balances={overview.balancesByWallet}
          transactions={overview.transactions}
        />
        <Animated.View
          layout={netWorthLayout}
          className="gap-5"
        >
          {groups.map((group) => {
            const isMain = group.main;
            const { name } = currencyName(group.currency);
            return (
              <View
                key={group.currency}
                className="gap-2"
              >
                <View className="flex-row items-baseline justify-between gap-2 px-1">
                  <Text
                    variant="caps"
                    className="text-muted"
                    accessibilityRole="header"
                  >
                    {isMain ? `${name}, main currency` : name}
                  </Text>
                  <Text className="text-[13px] leading-[18px] font-display-semibold text-ink-2">
                    {formatMoney(group.totalMinor, group.currency)}
                  </Text>
                </View>
                <ListCard>
                  {group.wallets.map((wallet) => (
                    <WalletRow
                      key={wallet.id}
                      wallet={wallet}
                      balance={formatMoney(
                        overview.balancesByWallet[wallet.id] ?? 0,
                        wallet.currency,
                      )}
                      meta={walletListMeta(wallet, isMain, linked.has(wallet.id))}
                    />
                  ))}
                </ListCard>
                {isMain ? null : (
                  <KeptApart text={keptApartLine(group.currency, currency)} />
                )}
              </View>
            );
          })}
          <AddWallet />
        </Animated.View>
      </PageScroll>
      )}
    </Page>
  );
}

function WalletRow({
  wallet,
  balance,
  meta,
}: {
  wallet: FinanceWallet;
  balance: string;
  meta: string;
}) {
  const tokens = useThemeTokens();
  const tint = walletTint(wallet.cardStyleId, wallet.type);
  return (
    <Press
      testID={tid('wallet', 'list', 'row', wallet.id)}
      accessibilityLabel={`${wallet.name}, ${meta}, ${balance}`}
      onPress={() =>
        router.push({ pathname: '/wallet/[id]', params: { id: wallet.id } })
      }
      className="min-h-[66px] flex-row items-center gap-3.5 py-3 pl-[18px] pr-3"
    >
      <View
        className={`h-[42px] w-[42px] items-center justify-center rounded-full ${WALLET_TINT_CLASS[tint]}`}
      >
        <IconSymbol
          name={resolveWalletIcon(wallet.icon, wallet.type)}
          size={20}
          color={tint === 'sand' ? tokens.foreground : tokens.onCategory}
        />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          variant="rowTitle"
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
          {meta}
        </Text>
      </View>
      <Text
        className="-mr-1.5 text-[15px] leading-5 text-ink-2"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {balance}
      </Text>
      <IconSymbol
        name="chevron-right"
        size={20}
        color={tokens.muted}
      />
    </Press>
  );
}

function ReorderGroup({
  group,
  balances,
  onMove,
}: {
  group: WalletGroup;
  balances: Readonly<Record<string, MinorAmount>>;
  onMove: (ids: string[]) => void;
}) {
  const tokens = useThemeTokens();
  const reorder = useReorder({
    ids: group.wallets.map((wallet) => wallet.id),
    step: ROW,
    axis: 'y',
    start: 'handle',
    liftScale: 1.02,
    dim: false,
    liftColor: tokens.card,
    gestureId: (id) => tid('wallet', 'list', 'row', id, 'handle'),
    onMove,
  });
  return (
    <View className="gap-2">
      <Text
        variant="caps"
        className="px-1 text-muted"
        accessibilityRole="header"
      >
        {currencyName(group.currency).name}
      </Text>
      <View
        className="rounded-[26px] bg-card"
        style={{ height: group.wallets.length * ROW }}
      >
        {group.wallets.map((wallet, index) => (
          <ReorderItem
            key={wallet.id}
            reorder={reorder}
            id={wallet.id}
            index={index}
          >
            <ReorderRow
              wallet={wallet}
              balance={formatMoney(balances[wallet.id] ?? 0, wallet.currency)}
              onStep={(by) => onMove(moveWallet([group], wallet.id, index + by))}
            />
          </ReorderItem>
        ))}
      </View>
    </View>
  );
}

function ReorderRow({
  wallet,
  balance,
  onStep,
}: {
  wallet: FinanceWallet;
  balance: string;
  onStep: (by: number) => void;
}) {
  const tokens = useThemeTokens();
  const tint = walletTint(wallet.cardStyleId, wallet.type);
  return (
    <View
      className="flex-row items-center gap-3.5 pl-[18px] pr-2.5"
      style={{ height: ROW }}
    >
      <View
        className={`h-[42px] w-[42px] items-center justify-center rounded-full ${WALLET_TINT_CLASS[tint]}`}
      >
        <IconSymbol
          name={resolveWalletIcon(wallet.icon, wallet.type)}
          size={20}
          color={tint === 'sand' ? tokens.foreground : tokens.onCategory}
        />
      </View>
      <Text
        variant="rowTitle"
        className="min-w-0 flex-1 text-foreground"
        numberOfLines={1}
      >
        {wallet.name}
      </Text>
      <Text
        className="text-[15px] leading-5 text-ink-2"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {balance}
      </Text>
      <ReorderHandle>
        <View
          testID={tid('wallet', 'list', 'row', wallet.id, 'handle')}
          accessible
          accessibilityLabel={`Move ${wallet.name}`}
          accessibilityActions={[
            { name: 'decrement', label: 'Move up' },
            { name: 'increment', label: 'Move down' },
          ]}
          onAccessibilityAction={(event) =>
            onStep(event.nativeEvent.actionName === 'increment' ? 1 : -1)
          }
          className="h-11 w-11 items-center justify-center"
        >
          <IconSymbol
            name="drag"
            size={22}
            color={tokens.muted}
          />
        </View>
      </ReorderHandle>
    </View>
  );
}

function KeptApart({ text }: { text: string }) {
  const tokens = useThemeTokens();
  return (
    <View className="flex-row gap-2 px-1">
      <View className="h-[18px] justify-center">
        <IconSymbol
          name="information-outline"
          size={16}
          color={tokens.muted}
        />
      </View>
      <Text
        variant="meta"
        className="flex-1 text-ink-2"
      >
        {text}
      </Text>
    </View>
  );
}

function AddWallet() {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={tid('wallet', 'list', 'add-wallet')}
      onPress={() => router.push('/wallet/new')}
      className="flex-row items-center gap-3.5 rounded-tile border-[1.5px] border-dashed border-hairline py-3 pl-[18px] pr-3"
    >
      <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-sand">
        <IconSymbol
          name="plus"
          size={20}
          color={tokens.foreground}
        />
      </View>
      <View className="flex-1">
        <Text
          variant="rowTitle"
          className="text-foreground"
        >
          Add a wallet
        </Text>
        <Text
          variant="meta"
          className="text-muted"
        >
          Bank, cash, e-wallet or card
        </Text>
      </View>
      <IconSymbol
        name="chevron-right"
        size={20}
        color={tokens.muted}
      />
    </Press>
  );
}
