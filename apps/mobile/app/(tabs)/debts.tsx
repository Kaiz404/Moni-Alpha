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
import type { DebtSide } from '@repo/core';
import { tid } from '@/lib/test-ids';

type Side = DebtSide | 'all';
type Status = 'open' | 'closed';

const SIDE_LABEL: Record<Side, string> = {
  all: 'Everyone',
  owed_to_me: SIDE_WORDS.owed_to_me.tile,
  i_owe: SIDE_WORDS.i_owe.tile,
};
const STATUS_LABEL: Record<Status, string> = {
  open: 'Open',
  closed: 'Settled',
};
const people = (count: number) => `${count} ${count === 1 ? 'person' : 'people'}`;

export default function DebtsScreen() {
  const scroll = useRef<ScrollView>(null);
  useScrollToTop(scroll);
  const clearance = useTabBarClearance();
  const summary = useDebtSummary();
  const [side, setSide] = useState<Side>('all');
  const [status, setStatus] = useState<Status>('open');
  const empty =
    summary.open.length === 0 && summary.closed.length === 0;
  const allSettled = summary.open.length === 0 && !empty;
  const onSide = <T extends { debt: { direction: DebtSide } }>(line: T) =>
    side === 'all' || line.debt.direction === side;
  const open = summary.open.filter(onSide);
  const closed = summary.closed.filter(onSide);
  const comingUp = summary.comingUp.filter((row) => onSide(row.line));

  const pickSide = async () => {
    const picked = await openSheet({
      kind: 'choice',
      title: 'Show',
      selected: side,
      options: [
        { id: 'all', label: SIDE_LABEL.all, icon: 'account-multiple-outline', meta: people(summary.open.length) },
        { id: 'owed_to_me', label: SIDE_LABEL.owed_to_me, icon: 'arrow-bottom-left', meta: debtMoney(summary.owedToMeMinor, summary.currency) },
        { id: 'i_owe', label: SIDE_LABEL.i_owe, icon: 'arrow-top-right', meta: debtMoney(summary.iOweMinor, summary.currency) },
      ],
    });
    if (picked === 'all' || picked === 'owed_to_me' || picked === 'i_owe') setSide(picked);
  };
  const pickStatus = async () => {
    const picked = await openSheet({
      kind: 'choice',
      title: 'Status',
      selected: status,
      options: [
        { id: 'open', label: 'Open', icon: 'handshake-outline', meta: people(summary.open.length) },
        { id: 'closed', label: 'Settled and written off', icon: 'check', meta: people(summary.closed.length) },
      ],
    });
    if (picked === 'open' || picked === 'closed') setStatus(picked);
  };

  const lines = status === 'open' ? open : closed;

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
                  People
                </Text>
                <View className="flex-row gap-2">
                  <FilterTrigger
                    testID={tid('debts', 'filter', 'side')}
                    name="Show"
                    label={SIDE_LABEL[side]}
                    active={side !== 'all'}
                    onPress={() => void pickSide()}
                  />
                  <FilterTrigger
                    testID={tid('debts', 'filter', 'status')}
                    name="Status"
                    label={STATUS_LABEL[status]}
                    active={status !== 'open'}
                    onPress={() => void pickStatus()}
                  />
                </View>
              </View>
              <Animated.View
                key={`${status}-${side}`}
                entering={FadeIn.duration(200)}
              >
                {status === 'open' && allSettled ? (
                  <AllSettledTile />
                ) : lines.length > 0 ? (
                  <ListCard>
                    {lines.map((line) =>
                      status === 'open' ? (
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
                    Nobody here right now.
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
