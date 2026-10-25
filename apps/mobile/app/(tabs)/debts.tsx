import { router, useScrollToTop } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ComingUp } from '@/components/debts/coming-up';
import { SIDE_WORDS } from '@/components/debts/debt-words';
import { NetPosition } from '@/components/debts/net-position';
import { PersonRow } from '@/components/debts/person-row';
import { SettledList } from '@/components/debts/settled-list';
import { useDebtSummary } from '@/components/debts/use-debts';
import { useTabBarClearance } from '@/components/nav/tab-bar';
import { SyncBanner } from '@/components/providers/sync-banner';
import { Button } from '@/components/ui/button';
import { EmptyTile } from '@/components/ui/empty-tile';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Page } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { DebtSide } from '@/lib/finance/debt-summary';
import { tid } from '@/lib/test-ids';

export default function DebtsScreen() {
  const scroll = useRef<ScrollView>(null);
  useScrollToTop(scroll);
  const tokens = useThemeTokens();
  const clearance = useTabBarClearance();
  const summary = useDebtSummary();
  const [filter, setFilter] = useState<DebtSide | null>(null);
  const [showClosed, setShowClosed] = useState<boolean | null>(null);
  const empty =
    summary.open.length === 0 && summary.closed.length === 0;
  const allSettled = summary.open.length === 0 && !empty;
  const people = filter
    ? summary.open.filter((line) => line.debt.direction === filter)
    : summary.open;

  return (
    <Page
      screen="debts"
      kind="tabRoot"
      title="Debts"
      trailing={
        empty ? null : (
          <Button
            testID={tid('debts', 'record-debt')}
            variant="secondary"
            compact
            icon="plus"
            label="Record a debt"
            className="self-start"
            onPress={() => router.push('/debt/new')}
          />
        )
      }
    >
      <ScrollView
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
            <NetPosition
              summary={summary}
              filter={filter}
              onFilter={setFilter}
            />
            <ComingUp rows={summary.comingUp} />
            <View className="gap-2 pt-1">
              <View className="min-h-9 flex-row items-center justify-between">
                <Text
                  variant="sectionTitle"
                  className="text-foreground"
                  accessibilityRole="header"
                >
                  {filter ? SIDE_WORDS[filter].tile : 'People'}
                </Text>
                {filter ? (
                  <Press
                    testID={tid('debts', 'show-everyone')}
                    hitSlop={4}
                    className="h-9 flex-row items-center gap-0.5 rounded-full"
                    onPress={() => setFilter(null)}
                  >
                    <Text className="text-[15px] leading-[21px] font-display-semibold text-deep-mint">
                      Show everyone
                    </Text>
                    <IconSymbol
                      name="close"
                      size={18}
                      color={tokens.deepMint}
                    />
                  </Press>
                ) : null}
              </View>
              {allSettled ? (
                <AllSettledTile />
              ) : people.length > 0 ? (
                <ListCard>
                  {people.map((line) => (
                    <PersonRow
                      key={line.debt.id}
                      line={line}
                    />
                  ))}
                </ListCard>
              ) : (
                <Text
                  variant="body"
                  className="px-1 text-muted"
                >
                  Nobody here right now.
                </Text>
              )}
              <SettledList
                lines={summary.closed}
                open={showClosed ?? allSettled}
                onToggle={() =>
                  setShowClosed(!(showClosed ?? allSettled))
                }
              />
            </View>
          </>
        )}
      </ScrollView>
    </Page>
  );
}

/** V2P-DebtsEmpty: the dashed tile when there are no debts at all. */
function NoDebtsTile() {
  return (
    <EmptyTile
      icon="handshake-outline"
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
  const tokens = useThemeTokens();
  return (
    <View className="flex-row items-center gap-3.5 rounded-tile border-[1.5px] border-dashed border-border-strong p-[18px]">
      <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-primary-muted">
        <IconSymbol
          name="check-bold"
          size={20}
          color={tokens.states.approved}
        />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          variant="cardTitle"
          className="text-foreground"
        >
          Nobody owes anybody
        </Text>
        <Text className="text-[14px] leading-[20px] text-ink-2">
          Every debt is paid back. They stay under Settled.
        </Text>
      </View>
    </View>
  );
}
