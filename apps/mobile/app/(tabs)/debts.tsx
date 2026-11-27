import { router, useScrollToTop } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { FilterTrigger } from '@/components/activity/filter-row';
import { Mascot } from '@/components/brand/mascot';
import { ClosedRow } from '@/components/debts/closed-row';
import { ComingUp } from '@/components/debts/coming-up';
import { debtMoney, SIDE_WORDS } from '@/components/debts/debt-words';
import { NetPosition } from '@/components/debts/net-position';
import { PersonRow } from '@/components/debts/person-row';
import { useDebtSummary } from '@/components/debts/use-debts';
import { useTabBarClearance } from '@/components/nav/tab-bar';
import { SyncBanner } from '@/components/providers/sync-banner';
import { EmptyTile } from '@/components/ui/empty-tile';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Page, PageScroll } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { openSheet } from '@/lib/sheet/sheet-store';
import {
  DEBT_SIDES,
  DEBT_STATUS_CHOICES,
  filterDebts,
  type DebtFilter,
  type DebtSide,
  type DebtStatusChoice,
} from '@repo/core';
import { tid } from '@/lib/test-ids';

const SIDE_LABEL: Record<DebtSide, string> = {
  owed_to_me: SIDE_WORDS.owed_to_me.tile,
  i_owe: SIDE_WORDS.i_owe.tile,
};
const STATUS_LABEL: Record<DebtStatusChoice, string> = {
  open: 'Open',
  closed: 'Settled',
};
const debtCount = (count: number) => `${count} ${count === 1 ? 'debt' : 'debts'}`;
const isSide = (id: string): id is DebtSide => DEBT_SIDES.some((side) => side === id);
const isStatus = (id: string): id is DebtStatusChoice =>
  DEBT_STATUS_CHOICES.some((status) => status === id);

/** A filter trigger's words: the default when every choice is ticked, else the one ticked choice. */
function ticked<T extends string>(picked: readonly T[], labels: Record<T, string>, every: string) {
  return picked.length === 1 ? labels[picked[0]!] : every;
}

export default function DebtsScreen() {
  const scroll = useRef<ScrollView>(null);
  useScrollToTop(scroll);
  const clearance = useTabBarClearance();
  const summary = useDebtSummary();
  const [filter, setFilter] = useState<DebtFilter>({ sides: [], statuses: [] });
  const empty =
    summary.open.length === 0 && summary.closed.length === 0;
  const onlyOpen = filter.statuses.length === 1 && filter.statuses[0] === 'open';
  const allSettled = summary.open.length === 0 && !empty && onlyOpen;
  const { lines, comingUp } = filterDebts(summary, filter);

  const pickSides = async () => {
    const picked = await openSheet({
      kind: 'choices',
      title: 'Show',
      selectedIds: filter.sides,
      options: [
        { id: 'owed_to_me', label: SIDE_LABEL.owed_to_me, icon: 'arrow-bottom-left', meta: debtMoney(summary.owedToMeMinor, summary.currency) },
        { id: 'i_owe', label: SIDE_LABEL.i_owe, icon: 'arrow-top-right', meta: debtMoney(summary.iOweMinor, summary.currency) },
      ],
    });
    if (picked) setFilter((current) => ({ ...current, sides: picked.ids.filter(isSide) }));
  };
  const pickStatuses = async () => {
    const picked = await openSheet({
      kind: 'choices',
      title: 'Status',
      selectedIds: filter.statuses,
      options: [
        { id: 'open', label: 'Open', icon: 'handshake-outline', meta: debtCount(summary.open.length) },
        { id: 'closed', label: 'Settled and written off', icon: 'check', meta: debtCount(summary.closed.length) },
      ],
    });
    if (picked) setFilter((current) => ({ ...current, statuses: picked.ids.filter(isStatus) }));
  };

  return (
    <Page
      headerScrolls
      screen="debts"
      kind="tabRoot"
      title="Debts"
    >
      <PageScroll
        ref={scroll}
        className="flex-1"
        contentContainerClassName="gap-4 px-5"
        contentContainerStyle={{ paddingBottom: clearance }}
        showsVerticalScrollIndicator={false}
      >
        <SyncBanner screen="debts" />
        {empty ? (
          <NoDebtsTile />
        ) : (
          <>
            <NetPosition summary={summary} />
            <RecordDebtCard />
            <ComingUp rows={comingUp} />
            <View className="gap-2 pt-1">
              <View className="min-h-9 flex-row items-center justify-between gap-2">
                <Text
                  variant="sectionTitle"
                  className="text-foreground"
                  accessibilityRole="header"
                >
                  Records
                </Text>
                <View className="flex-row gap-2">
                  <FilterTrigger
                    testID={tid('debts', 'filter', 'side')}
                    name="Show"
                    label={ticked(filter.sides, SIDE_LABEL, 'Everyone')}
                    active={filter.sides.length > 0}
                    onPress={() => void pickSides()}
                  />
                  <FilterTrigger
                    testID={tid('debts', 'filter', 'status')}
                    name="Status"
                    label={ticked(filter.statuses, STATUS_LABEL, 'All')}
                    active={filter.statuses.length > 0}
                    onPress={() => void pickStatuses()}
                  />
                </View>
              </View>
              <Animated.View
                key={`${filter.statuses.join()}-${filter.sides.join()}`}
                entering={FadeIn.duration(200)}
              >
                {allSettled ? (
                  <AllSettledTile />
                ) : lines.length > 0 ? (
                  <ListCard>
                    {lines.map((line) =>
                      line.state === 'open' ? (
                        <PersonRow
                          key={line.debt.id}
                          line={line}
                        />
                      ) : (
                        <ClosedRow
                          key={line.debt.id}
                          line={line}
                        />
                      ),
                    )}
                  </ListCard>
                ) : (
                  <Text
                    variant="body"
                    className="px-1 text-muted"
                  >
                    No debts here right now.
                  </Text>
                )}
              </Animated.View>
            </View>
          </>
        )}
      </PageScroll>
    </Page>
  );
}

function RecordDebtCard() {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={tid('debts', 'record-debt')}
      accessibilityLabel="Record a debt"
      onPress={() => router.push('/debt/new')}
      radius={{ rest: 22, pressed: 16 }}
      pressedClassName="bg-sand-light"
      className="min-h-[66px] flex-row items-center gap-3.5 bg-card py-3 pl-[18px] pr-3"
    >
      <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-sand">
        <IconSymbol
          name="plus"
          size={20}
          color={tokens.foreground}
        />
      </View>
      <Text
        variant="rowTitle"
        className="min-w-0 flex-1 text-foreground"
      >
        Record a debt
      </Text>
      <IconSymbol
        name="chevron-right"
        size={20}
        color={tokens.muted}
      />
    </Press>
  );
}

/** V2P-DebtsEmpty: the dashed tile when there are no debts at all. */
function NoDebtsTile() {
  return (
    <EmptyTile
      mood="happy"
      title="No debts yet"
      body="Lent a friend money, or they covered you? Note it here. Moni shows who owes who."
      action={{
        testID: tid('debts', 'empty', 'record-debt'),
        label: 'Record a debt',
        icon: 'plus',
        onPress: () => router.push('/debt/new'),
      }}
    />
  );
}

function AllSettledTile() {
  return (
    <View className="flex-row items-center gap-3.5 rounded-tile border-[1.5px] border-dashed border-border-strong p-[18px]">
      <Mascot
        mood="happy"
        size={44}
      />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          variant="cardTitle"
          className="text-foreground"
        >
          Nobody owes anybody
        </Text>
        <Text className="text-[14px] leading-[20px] text-ink-2">
          Every debt is paid back. Find them under Settled.
        </Text>
      </View>
    </View>
  );
}
