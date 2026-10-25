import { useValue } from '@legendapp/state/react';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { PaceChart } from '@/components/charts/pace-chart';
import { closingBalances } from '@/components/home/closing-balances';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import type { BubbleTint } from '@/components/ui/nav-row';
import { Page } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { walletBubbleTint } from '@/constants/wallet-card-styles';
import { resolveWalletIcon } from '@/constants/wallet-form';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { formatMoney } from '@/lib/finance/format-money';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { financeOverview$ } from '@/lib/finance/selectors';
import type { FinanceWallet } from '@/lib/finance/types';
import { wallets$ } from '@/lib/store';
import { getRecordValues } from '@/lib/store/helpers';
import { tid } from '@/lib/test-ids';

/** Section name and the plural used in the "kept apart" note. */
const CURRENCY_NAMES: Record<string, [string, string]> = {
  MYR: ['Ringgit', 'ringgit'],
  USD: ['US dollar', 'dollars'],
  SGD: ['Singapore dollar', 'Singapore dollars'],
  EUR: ['Euro', 'euros'],
  GBP: ['British pound', 'pounds'],
  AUD: ['Australian dollar', 'Australian dollars'],
  JPY: ['Japanese yen', 'yen'],
  IDR: ['Indonesian rupiah', 'rupiah'],
  THB: ['Thai baht', 'baht'],
  CNY: ['Chinese yuan', 'yuan'],
};

function currencyName(code: string): [string, string] {
  return CURRENCY_NAMES[code] ?? [code, code];
}

const TYPE_LABEL: Record<string, string> = {
  bank: 'Bank',
  cash: 'Cash',
  credit: 'Card',
  debit: 'Card',
  ewallet: 'E-wallet',
  investment: 'Investment',
  other: 'Wallet',
};

const tintClass: Record<BubbleTint, string> = {
  sand: 'bg-sand',
  mint: 'bg-mint',
  lemon: 'bg-lemon',
  lilac: 'bg-lilac',
  peach: 'bg-peach',
  coral: 'bg-coral',
  sky: 'bg-sky',
  aqua: 'bg-aqua',
};

function walletMeta(wallet: FinanceWallet, main: boolean, alertsOn: boolean): string {
  if (!main) return `${TYPE_LABEL[wallet.type] ?? 'Wallet'} · ${currencyName(wallet.currency)[1]}`;
  if (wallet.type === 'cash' && !alertsOn) return 'In your pocket';
  const type = TYPE_LABEL[wallet.type] ?? 'Wallet';
  return alertsOn ? `${type} · alerts on` : type;
}

/** V2H-Wallets: every wallet, the main currency first with its balance line, others kept apart. */
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

  const groups = useMemo(() => {
    const byCurrency = new Map<string, FinanceWallet[]>();
    for (const wallet of overview.wallets)
      byCurrency.set(wallet.currency, [...(byCurrency.get(wallet.currency) ?? []), wallet]);
    return [...byCurrency.entries()]
      .map(([code, wallets]) => ({
        code,
        wallets,
        totalMinor: wallets.reduce(
          (sum, wallet) => sum + Number(overview.balancesByWallet[wallet.id] ?? 0),
          0,
        ),
      }))
      .sort((a, b) =>
        a.code === currency ? -1 : b.code === currency ? 1 : a.code.localeCompare(b.code),
      );
  }, [overview.wallets, overview.balancesByWallet, currency]);

  const main = groups.find((group) => group.code === currency);
  const series = useMemo(
    () =>
      closingBalances({
        now: new Date(),
        walletIds: new Set(main?.wallets.map((wallet) => wallet.id) ?? []),
        balanceMinor: main?.totalMinor ?? 0,
        transactions: overview.transactions,
      }),
    [main, overview.transactions],
  );

  return (
    <Page
      screen="wallet"
      kind="pushed"
      title="Wallets"
      trailing={
        <HeaderIconButton
          testID={tid('wallet', 'list', 'add')}
          icon="plus"
          accessibilityLabel="Add a wallet"
          onPress={() => router.push('/wallet/new')}
        />
      }
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-2 rounded-card bg-card px-[18px] py-3.5">
          <Text
            variant="caps"
            className="min-h-9 text-muted"
            style={{ textAlignVertical: 'center' }}
          >
            Net worth
          </Text>
          <View>
            <Text
              testID={tid('wallet', 'list', 'net-worth')}
              className="text-[32px] leading-9 font-display-bold text-foreground"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {formatMoney(main?.totalMinor ?? 0, currency)}
            </Text>
            <Text
              variant="meta"
              className="text-ink-2"
            >
              {`${currency} wallets, closing balance each day`}
            </Text>
          </View>
          {main ? (
            <PaceChart
              screen="wallet"
              mode="balance"
              series={series}
              budget={null}
              currency={currency}
            />
          ) : null}
        </View>

        {groups.map((group) => {
          const isMain = group.code === currency;
          const [name, plural] = currencyName(group.code);
          return (
            <View
              key={group.code}
              className="gap-2"
            >
              <View className="flex-row items-baseline justify-between gap-2 px-1">
                <Text
                  variant="caps"
                  className="text-muted"
                  accessibilityRole="header"
                >
                  {isMain ? `${name} · main currency` : name}
                </Text>
                <Text className="text-[13px] leading-[18px] font-display-semibold text-ink-2">
                  {formatMoney(group.totalMinor, group.code)}
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
                    meta={walletMeta(wallet, isMain, linked.has(wallet.id))}
                  />
                ))}
              </ListCard>
              {isMain ? null : (
                <KeptApart text={`Kept apart. Moni never converts ${plural} or adds them to your ${currencyName(currency)[1]}.`} />
              )}
            </View>
          );
        })}
        <AddWallet />
      </ScrollView>
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
  const tint = walletBubbleTint(wallet.cardStyleId, wallet.type);
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
        className={`h-[42px] w-[42px] items-center justify-center rounded-full ${tintClass[tint]}`}
      >
        <IconSymbol
          name={resolveWalletIcon(wallet.icon, wallet.type)}
          size={20}
          color={tint === 'sand' ? tokens.foreground : tokens.onPastel}
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
