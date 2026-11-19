import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';

import { TextTile } from '@/components/amount/text-tile';
import { DebtHistory } from '@/components/debt/debt-history';
import {
  OpenStanding,
  SquareCard,
  WrittenOff,
} from '@/components/debt/debt-standing';
import {
  dueLabel,
  DueDateSheet,
} from '@/components/debt/due-date-sheet';
import { useDebtWallets } from '@/components/debts/debt-wallets';
import { SIDE_WORDS } from '@/components/debts/debt-words';
import { PersonAvatar } from '@/components/debts/person-avatar';
import {
  sendReminder,
  useRemindedToday,
} from '@/components/debts/reminder';
import { useDebt } from '@/components/debts/use-debts';
import { SyncBanner } from '@/components/providers/sync-banner';
import { Button } from '@/components/ui/button';
import { NotFound } from '@/components/ui/empty-tile';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { InPlaceField, InPlaceGroup, type Saved } from '@/components/ui/in-place-field';
import { ListCard } from '@/components/ui/list-card';
import { Page, PageActions, PageScroll } from '@/components/ui/page';
import { PickerField } from '@/components/ui/picker-field';
import { NavRow } from '@/components/ui/nav-row';
import { Text } from '@/components/ui/text';
import { approve } from '@/lib/haptics';
import { openSheet } from '@/lib/sheet/sheet-store';
import {
  deleteDebtActivity,
  getDebtById,
  repayDebt,
  updateDebt,
  writeOffDebt,
} from '@/lib/supabase/debts';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import {
  daysUntil,
  type DebtLine,
  type FinanceDebtActivity,
  dateLabel,
  dueWords,
  formatMoney,
} from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { line, activities } = useDebt(id);
  if (!line)
    return (
      <Page
        screen="debts"
        kind="pushed"
        title="Debt"
      >
        <NotFound
          icon="handshake-outline"
          title="This debt isn't here any more"
          body="It may have been deleted on another phone."
        />
      </Page>
    );
  return (
    <DebtPage
      line={line}
      activities={activities}
    />
  );
}

function failed(error: unknown) {
  showToast({
    text:
      error instanceof Error ? error.message : "Couldn't save that",
    tone: 'removed',
  });
}

/** Saves one field in place and offers Undo back to what it was. */
function saveField(
  id: string,
  patch: Parameters<typeof updateDebt>[1],
  previous: Parameters<typeof updateDebt>[1],
): Saved {
  updateDebt(id, patch);
  return { undo: () => updateDebt(id, previous) };
}

function DebtPage({
  line,
  activities,
}: {
  line: DebtLine;
  activities: FinanceDebtActivity[];
}) {
  const { debt, balanceMinor, state } = line;
  const {
    id,
    counterpartyName: name,
    direction,
    currency,
    note,
  } = debt;
  const words = SIDE_WORDS[direction];
  const reminded = useRemindedToday();
  const { wallets } = useDebtWallets(currency);
  const [dueOpen, setDueOpen] = useState(false);
  const closeDue = useCallback(() => setDueOpen(false), []);
  const settling = useRef(false);
  const open = state === 'open';
  const [openedOpen] = useState(open);
  const money = (minor: number) => formatMoney(minor, currency);

  const settle = async () => {
    if (settling.current) return;
    const walletId =
      activities.find((activity) =>
        wallets.some((wallet) => wallet.id === activity.walletId),
      )?.walletId ?? wallets[0]?.id;
    if (!walletId) {
      router.push({
        pathname: '/debt/amount',
        params: { id, mode: 'repay' },
      });
      return;
    }
    approve();
    settling.current = true;
    try {
      const stored = await getDebtById(id);
      if (!stored) throw new Error('This debt is gone');
      const activity = await repayDebt(
        stored,
        balanceMinor,
        walletId,
      );
      showToast({
        text: `Recorded ${money(balanceMinor)}`,
        undo: () => void deleteDebtActivity(stored, activity.id),
      });
    } catch (error) {
      failed(error);
    } finally {
      settling.current = false;
    }
  };

  const writeOff = async () => {
    const confirmed = await openSheet({
      kind: 'confirm',
      title: `Write off ${money(balanceMinor)}?`,
      message: words.writeOffBody(name),
      confirmLabel: 'Write off',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const stored = await getDebtById(id);
      if (!stored) throw new Error('This debt is gone');
      const activity = await writeOffDebt(stored);
      showToast({
        text: `Wrote off ${money(balanceMinor)}`,
        tone: 'removed',
        undo: () => void deleteDebtActivity(stored, activity.id),
      });
    } catch (error) {
      failed(error);
    }
  };

  const days = debt.dueDate
    ? daysUntil(debt.dueDate, new Date(), deviceCalendar)
    : null;
  const dueTitle =
    days === null
      ? 'Due date'
      : days < 0
        ? dueWords(days)
        : `Due ${dueWords(days).toLowerCase()}`;
  const toAmount = (mode: 'repay' | 'more') =>
    router.push({ pathname: '/debt/amount', params: { id, mode } });
  const remindedToday = reminded(id);

  return (
    <View className="flex-1">
      <Page
        headerScrolls
        screen="debts"
        kind="pushed"
        title="Debt"
        trailing={
          open ? (
            <HeaderIconButton
              testID={tid('debts', 'write-off')}
              icon="text-box-remove-outline"
              accessibilityLabel={`Write off ${money(balanceMinor)}`}
              onPress={() => void writeOff()}
            />
          ) : undefined
        }
      >
        <InPlaceGroup>
        <PageScroll
          className="flex-1"
          contentContainerClassName="gap-4 px-5 pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SyncBanner screen="debts" />
          <InPlaceField
            testID={tid('debts', 'name')}
            label="Name"
            kind="text"
            required
            maxLength={120}
            value={name}
            onSave={(value) =>
              value === name
                ? undefined
                : saveField(id, { counterpartyName: value }, { counterpartyName: name })
            }
          >
            {({ editable, editor }) =>
              editor ? (
                <View className="gap-1.5">
                  <Text
                    variant="meta"
                    className="text-muted"
                  >
                    Name
                  </Text>
                  {editor}
                </View>
              ) : (
                <View className="flex-row items-center gap-3">
                  <PersonAvatar
                    name={name}
                    size={52}
                  />
                  <View className="min-w-0 flex-1">
                    {editable(
                      <Text
                        variant="sectionTitle"
                        className="text-foreground"
                        numberOfLines={1}
                      >
                        {name}
                      </Text>,
                      { accessibilityLabel: `Edit name, ${name}` },
                    )}
                    <Text
                      variant="meta"
                      className="-mt-2 text-muted"
                    >
                      {words.started} {dateLabel(deviceCalendar.dayKey(line.startedAt), deviceCalendar.dayKey(new Date()))}
                    </Text>
                  </View>
                </View>
              )
            }
          </InPlaceField>

          {open ? (
            <OpenStanding line={line} />
          ) : state === 'settled' ? (
            <SquareCard
              line={line}
              pop={openedOpen}
            />
          ) : (
            <WrittenOff line={line} />
          )}

          <View className="gap-2">
            {open ? (
              <PickerField
                testID={tid('debts', 'due-date')}
                label={dueTitle}
                value={debt.dueDate ? dueLabel(debt.dueDate) : 'No date'}
                icon="calendar-clock"
                onPress={() => setDueOpen(true)}
              />
            ) : null}
            <NoteField
              key={note ?? ''}
              id={id}
              note={note}
            />
          </View>

          {open ? (
            <ListCard>
              <NavRow
                testID={tid('debts', 'settle')}
                icon="check-all"
                title={words.settle}
                onPress={() => void settle()}
              />
              {direction === 'owed_to_me' ? (
                <NavRow
                  testID={tid('debts', 'remind')}
                  icon="send-outline"
                  title={`Remind ${name}`}
                  value={remindedToday ? 'Reminded today' : undefined}
                  onPress={() => void sendReminder(line)}
                />
              ) : null}
            </ListCard>
          ) : null}

          <DebtHistory
            debt={debt}
            activities={activities}
          />
        </PageScroll>
        </InPlaceGroup>
        {open ? (
          <PageActions>
            <Button
              testID={tid('debts', 'record-repayment')}
              icon="cash-refund"
              label="Record repayment"
              pinned
              className="flex-1"
              onPress={() => toAmount('repay')}
            />
            <Button
              testID={tid('debts', 'lend-more')}
              variant="secondary"
              icon="plus"
              label={words.more}
              pinned
              className="flex-1"
              onPress={() => toAmount('more')}
            />
          </PageActions>
        ) : null}
      </Page>
      <DueDateSheet
        open={dueOpen}
        selected={debt.dueDate}
        onDismiss={closeDue}
        onPick={(dueDate) => {
          setDueOpen(false);
          if (dueDate === debt.dueDate) return;
          try {
            const { undo } = saveField(id, { dueDate }, { dueDate: debt.dueDate });
            showToast({ text: 'Due date saved', undo });
          } catch (error) {
            failed(error);
          }
        }}
      />
    </View>
  );
}

/** The Note in the app's typed field: it saves when the keyboard leaves it, with Undo. */
function NoteField({ id, note }: { id: string; note: string | null }) {
  const [draft, setDraft] = useState(note ?? '');
  return (
    <TextTile
      testID={tid('debts', 'note')}
      label="Note"
      icon="note-text-outline"
      placeholder="What is it for?"
      maxLength={1000}
      value={draft}
      onChangeText={setDraft}
      onBlur={() => {
        const next = draft.trim() || null;
        if (next === note) return;
        try {
          const { undo } = saveField(id, { note: next }, { note });
          showToast({ text: 'Note saved', undo });
        } catch (error) {
          failed(error);
        }
      }}
    />
  );
}
