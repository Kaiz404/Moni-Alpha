import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyTile } from '@/components/ui/empty-tile';
import { ListCard, ListSection } from '@/components/ui/list-card';
import { Page } from '@/components/ui/page';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth/auth-context';
import { applyPlan, type ApplyProgress } from '@/lib/backup/apply';
import type { ImportRow } from '@/lib/backup/generic-csv';
import { getImportSession, planImport, setImportSession } from '@/lib/backup/import-session';
import { TABLES, TABLE_ORDER } from '@/lib/backup/moni-export';
import { restoreTotals, type ImportPlan } from '@/lib/backup/plan';
import { dayLabel } from '@/lib/dates/day-label';
import { formatSignedMoney } from '@/lib/finance/format-money';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';

const SHOWN_ROWS = 20;

function totals(plan: ImportPlan): { fresh: number; here: number } {
  return plan.kind === 'restore'
    ? restoreTotals(plan)
    : { fresh: plan.fresh.length, here: plan.here.length };
}

function Figure({ testID, label, value }: { testID: string; label: string; value: number }) {
  return (
    <View className="min-w-0 flex-1">
      <Text
        testID={testID}
        variant="screenTitle"
        className="text-foreground"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value.toLocaleString('en-US')}
      </Text>
      <Text
        variant="meta"
        className="text-ink-2"
      >
        {label}
      </Text>
    </View>
  );
}

function PlainRow({
  title,
  meta,
  trailing,
}: {
  title: string;
  meta?: string;
  trailing?: string;
}) {
  return (
    <View
      accessible
      className="min-h-[56px] flex-row items-center gap-3 px-[18px] py-2"
    >
      <View className="min-w-0 flex-1">
        <Text
          variant="rowTitle"
          className="text-foreground"
          numberOfLines={1}
        >
          {title}
        </Text>
        {meta ? (
          <Text
            variant="meta"
            className="text-muted"
            numberOfLines={2}
          >
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <Text
          variant="body"
          className="text-ink-2"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {trailing}
        </Text>
      ) : null}
    </View>
  );
}

function RowList({
  label,
  rows,
  currency,
}: {
  label: string;
  rows: readonly ImportRow[];
  currency: string;
}) {
  if (!rows.length) return null;
  const more = rows.length - SHOWN_ROWS;
  return (
    <ListSection
      label={label}
      gap={8}
      className="mt-2"
    >
      <ListCard>
        {rows.slice(0, SHOWN_ROWS).map((row) => (
          <PlainRow
            key={row.line}
            title={row.merchant ?? row.note ?? 'No merchant'}
            meta={dayLabel(row.day)}
            trailing={formatSignedMoney(row.type, row.amountMinor, currency)}
          />
        ))}
        {more > 0 ? <PlainRow title={`And ${more.toLocaleString('en-US')} more`} /> : null}
      </ListCard>
    </ListSection>
  );
}

/** "N new, M already here" before anything is written. */
export default function ImportPreviewScreen() {
  const { user } = useAuth();
  const session = getImportSession();
  const userId = user?.id ?? null;
  const plan = useMemo(
    () => (session && userId ? planImport(session, userId) : null),
    [session, userId],
  );
  const [progress, setProgress] = useState<ApplyProgress | null>(null);

  if (!session || !userId || !plan) {
    return (
      <Page
        screen="import"
        kind="pushed"
        title="Check the file"
      >
        <View className="px-5">
          <EmptyTile
            icon="file-outline"
            tone="notice"
            title="No file chosen"
            body="Go back and choose a CSV."
          />
        </View>
      </Page>
    );
  }

  const { fresh, here } = totals(plan);
  const noun = plan.kind === 'restore' ? 'row' : 'transaction';
  const nouns = (count: number) =>
    `${count.toLocaleString('en-US')} ${noun}${count === 1 ? '' : 's'}`;
  const verb = plan.kind === 'restore' ? 'Restore' : 'Add';
  const currency = session.kind === 'generic' ? (session.choices.wallet?.currency ?? '') : '';

  const leave = (to: '/activity' | '/profile') => {
    setImportSession(null);
    router.dismissTo(to);
  };
  const write = async () => {
    setProgress({ done: 0, total: fresh });
    try {
      // Planned again here: anything that arrived since the preview is not written twice.
      const latest = planImport(session, userId);
      const written = latest ? await applyPlan(latest, setProgress) : 0;
      showToast({ text: `${verb === 'Add' ? 'Added' : 'Restored'} ${nouns(written)}` });
      leave('/activity');
    } catch {
      setProgress(null);
      showToast({
        text: "Couldn't finish. Import the file again: nothing adds twice.",
        tone: 'removed',
      });
    }
  };

  return (
    <Page
      screen="import"
      kind="pushed"
      title="Check the file"
      subtitle={session.fileName}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-5 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row gap-3 rounded-card bg-card px-[18px] py-3.5">
          <Figure
            testID={tid('import', 'new')}
            label="new"
            value={fresh}
          />
          <Figure
            testID={tid('import', 'here')}
            label="already here"
            value={here}
          />
        </View>
        <Button
          testID={tid('import', 'write')}
          label={fresh ? `${verb} ${nouns(fresh)}` : 'Done'}
          loading={progress !== null}
          loadingLabel={progress ? `${progress.done} of ${progress.total}` : undefined}
          onPress={fresh ? () => void write() : () => leave('/profile')}
        />
        {plan.kind === 'restore' ? (
          <ListCard>
            {TABLE_ORDER.filter(
              (table) => plan.counts[table].fresh + plan.counts[table].here > 0,
            ).map((table) => (
              <PlainRow
                key={table}
                title={TABLES[table].title}
                trailing={`${plan.counts[table].fresh} new · ${plan.counts[table].here} here`}
              />
            ))}
          </ListCard>
        ) : (
          <>
            <RowList
              label="New"
              rows={plan.fresh}
              currency={currency}
            />
            <RowList
              label="Already here"
              rows={plan.here}
              currency={currency}
            />
          </>
        )}
        {plan.problems.length ? (
          <ListSection
            label={`Can't be read · ${plan.problems.length}`}
            gap={8}
            className="mt-2"
          >
            <ListCard>
              {plan.problems.slice(0, SHOWN_ROWS).map((problem) => (
                <PlainRow
                  key={`${problem.line}-${problem.reason}`}
                  title={`Line ${problem.line}`}
                  meta={problem.reason}
                />
              ))}
            </ListCard>
          </ListSection>
        ) : null}
      </ScrollView>
    </Page>
  );
}
