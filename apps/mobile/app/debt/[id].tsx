import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

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
import { dueWords, SIDE_WORDS } from '@/components/debts/debt-words';
import { PersonAvatar } from '@/components/debts/person-avatar';
import {
  sendReminder,
  useRemindedToday,
} from '@/components/debts/reminder';
import { useDebt } from '@/components/debts/use-debts';
import { SyncBanner } from '@/components/providers/sync-banner';
import { NotFound } from '@/components/ui/empty-tile';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { InPlaceField, InPlaceGroup, type Saved } from '@/components/ui/in-place-field';
import { ListCard } from '@/components/ui/list-card';
import { Page } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatDate } from '@/lib/dates/day-label';
import { daysUntil, type DebtLine } from '@/lib/finance/debt-summary';
import { formatMoney } from '@/lib/finance/format-money';
import type { FinanceDebtActivity } from '@/lib/finance/types';
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
  const tokens = useThemeTokens();
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
    ? daysUntil(debt.dueDate, new Date())
    : null;
  const dueText = debt.dueDate
    ? `${dueLabel(debt.dueDate)}${days === null ? '' : ` · ${dueWords(days).toLowerCase()}`}`
    : 'No date';

  return (
    <View className="flex-1">
      <Page
        screen="debts"
        kind="pushed"
        title="Debt"
      >
        <InPlaceGroup>
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-5 pb-10"
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
                      {words.started} {formatDate(line.startedAt)}
                    </Text>
                  </View>
                </View>
              )
            }
          </InPlaceField>

          {open ? (
            <OpenStanding
              line={line}
              remindedToday={reminded(id)}
              onSettle={() => void settle()}
              onRemind={() => void sendReminder(line)}
            />
          ) : state === 'settled' ? (
            <SquareCard line={line} />
          ) : (
            <WrittenOff line={line} />
          )}

          <InPlaceField
            testID={tid('debts', 'note')}
            label="Note"
            kind="text"
            maxLength={1000}
            placeholder="What is it for?"
            value={note ?? ''}
            onSave={(value) =>
              value === (note ?? '')
                ? undefined
                : saveField(id, { note: value || null }, { note })
            }
          >
            {({ editable, editor }) =>
              editor ? (
                <View className="gap-1.5">
                  <Text
                    variant="meta"
                    className="text-muted"
                  >
                    Note
                  </Text>
                  {editor}
                </View>
              ) : (
                <ListCard>
                  {editable(
                    <View className="flex-row items-center gap-3.5">
                      <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-sand">
                        <IconSymbol
                          name="note-text-outline"
                          size={20}
                          color={tokens.foreground}
                        />
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text
                          variant="meta"
                          className="text-muted"
                        >
                          Note
                        </Text>
                        <Text
                          variant="rowTitle"
                          className={note ? 'text-foreground' : 'text-muted'}
                          numberOfLines={1}
                        >
                          {note ?? 'Add a note'}
                        </Text>
                      </View>
                    </View>,
                    {
                      className: 'flex-row items-center gap-3.5 px-[18px] py-3',
                      accessibilityLabel: `Edit note, ${note ?? 'no note'}`,
                    },
                  )}
                </ListCard>
              )
            }
          </InPlaceField>

          {open ? (
            <Press
              testID={tid('debts', 'due-date')}
              accessibilityLabel={`Due date, ${dueText}`}
              accessibilityHint="Opens a picker"
              pressedClassName="bg-hairline"
              className="h-16 justify-center gap-0.5 rounded-field bg-sand px-3.5"
              onPress={() => setDueOpen(true)}
            >
              <Text className="text-[13px] leading-[18px] text-muted">
                Due date
              </Text>
              <View className="flex-row items-center gap-1.5">
                <IconSymbol
                  name="calendar-clock"
                  size={18}
                  color={tokens.foreground}
                />
                <Text
                  variant="rowTitle"
                  className="flex-1 text-foreground"
                  numberOfLines={1}
                >
                  {dueText}
                </Text>
                <IconSymbol
                  name="chevron-down"
                  size={18}
                  color={tokens.foreground}
                />
              </View>
            </Press>
          ) : null}

          <DebtHistory
            debt={debt}
            activities={activities}
          />

          {open ? (
            <Press
              testID={tid('debts', 'write-off')}
              radius={{ rest: 22, pressed: 16 }}
              pressedClassName="bg-destructive-pressed"
              className="h-11 flex-row items-center justify-center gap-2 self-center bg-destructive-fill px-[18px]"
              onPress={() => void writeOff()}
            >
              <IconSymbol
                name="cancel"
                size={20}
                color={tokens.states.destructive}
              />
              <Text className="text-[15px] leading-[21px] font-display-semibold text-state-destructive">
                Write off {money(balanceMinor)}
              </Text>
            </Press>
          ) : null}
        </ScrollView>
        </InPlaceGroup>
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
