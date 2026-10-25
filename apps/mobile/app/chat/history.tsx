import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  SoftBubble,
  type SoftTint,
} from '@/components/chat/ink-card';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListSection } from '@/components/ui/list-card';
import { Page } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { SearchField } from '@/components/ui/search-field';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  deleteThread,
  listThreads,
  restoreThread,
  subscribeThreads,
  type ChatMessage,
  type ChatThread,
} from '@/lib/ai/chat/messages';
import { todayThreadDay } from '@/lib/ai/chat/sessions';
import { formatDate } from '@/lib/dates/day-label';
import { parseLocalDateInput } from '@/lib/dates/local-date-input';
import { formatSignedMoney } from '@/lib/finance/format-money';
import { financeProjection$ } from '@/lib/finance/projection';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import { resolveTransactionIcon } from '@/lib/transactions/icon';

type Topic = { icon: string | null; tint: SoftTint };

type Row = {
  day: string;
  title: string;
  count: number;
  pill: { text: string; tone: 'draft' | 'added' } | null;
  preview: string;
  topic: Topic;
  searchText: string;
};

/** The bubble a day wears: what its latest card was about, or Moni's Lilac for plain talk. */
function topicOf(messages: readonly ChatMessage[]): Topic {
  const projection = financeProjection$.peek();
  const categoryTopic = (
    categoryId: string | null | undefined,
    type: 'expense' | 'income',
  ): Topic => {
    const category = categoryId
      ? projection.categoriesById[categoryId]
      : null;
    return category
      ? {
          icon: resolveTransactionIcon(category.icon, type),
          tint: { color: category.color },
        }
      : { icon: 'receipt-text-outline', tint: 'sand' };
  };
  for (const message of [...messages].reverse()) {
    if (message.kind === 'assistant_draft') {
      const proposal = projection.proposalsById[message.proposalId];
      return categoryTopic(
        proposal?.categoryId,
        proposal?.type === 'income' ? 'income' : 'expense',
      );
    }
    if (message.kind !== 'assistant_card') continue;
    switch (message.card.kind) {
      case 'category_spend':
        return categoryTopic(message.card.categoryId, 'expense');
      case 'bill_due':
        return { icon: 'repeat', tint: 'lemon' };
      case 'budget_progress':
        return { icon: 'calendar-blank', tint: 'mint' };
      case 'captures':
        return { icon: 'inbox-arrow-down', tint: 'lilac' };
    }
  }
  return { icon: 'creation', tint: 'lilac' };
}

/** The latest thing said that a row can quote: words, a draft's merchant and amount, or its outcome. */
function previewOf(messages: readonly ChatMessage[]): string {
  const projection = financeProjection$.peek();
  for (const message of [...messages].reverse()) {
    switch (message.kind) {
      case 'user_text':
      case 'user_image':
      case 'assistant_clarify':
      case 'assistant_card':
        if (message.content) return message.content;
        break;
      case 'assistant_text':
        if (message.status === 'done') return message.content;
        break;
      case 'assistant_draft': {
        const proposal = projection.proposalsById[message.proposalId];
        if (!message.outcome && proposal?.amountMinor != null)
          return `${proposal.merchant ?? proposal.description ?? 'Capture'}, ${formatSignedMoney(proposal.type ?? 'expense', proposal.amountMinor, proposal.currency).replace(/^[−+]/, '')}`;
        break;
      }
      case 'assistant_status':
      case 'assistant_noticed':
        break;
    }
  }
  return '';
}

function toRow(thread: ChatThread, now: Date): Row {
  const date = parseLocalDateInput(thread.day) ?? now;
  const title =
    thread.day === todayThreadDay(now)
      ? 'Today'
      : formatDate(date, now);
  const talk = thread.messages.filter(
    (m) =>
      m.kind !== 'assistant_status' && m.kind !== 'assistant_noticed',
  );
  const drafts = thread.messages.filter(
    (m) => m.kind === 'assistant_draft',
  );
  const open = drafts.filter((m) => !m.outcome).length;
  const added = drafts.find((m) => m.outcome?.kind === 'approved');
  const words = thread.messages
    .map((m) => {
      if ('content' in m) return m.content;
      if (m.kind === 'assistant_draft') return m.outcome?.title ?? '';
      return '';
    })
    .join(' ');
  const preview = previewOf(thread.messages);
  return {
    day: thread.day,
    title,
    count: talk.length,
    pill: open
      ? {
          text: `${open} ${open === 1 ? 'draft' : 'drafts'}`,
          tone: 'draft',
        }
      : added?.kind === 'assistant_draft' && added.outcome
        ? {
            text: `Added ${added.outcome.title.split(' ').at(-1)}`,
            tone: 'added',
          }
        : null,
    preview,
    topic: topicOf(thread.messages),
    searchText:
      `${title} ${formatDate(date, now)} ${words} ${preview}`.toLowerCase(),
  };
}

/** V2H-ChatHistory: one row per past day, with search and delete with Undo. */
export default function ChatHistoryScreen() {
  const tokens = useThemeTokens();
  const [threads, setThreads] = useState(listThreads);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(
    () => subscribeThreads(() => setThreads(listThreads())),
    [],
  );

  const now = new Date();
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads
      .map((thread) => toRow(thread, now))
      .filter((row) => !q || row.searchText.includes(q));
    // `now` only labels days; the list follows the threads and the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, query]);

  const weekStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 6,
  );
  const pad = (n: number) => String(n).padStart(2, '0');
  const weekKey = `${weekStart.getFullYear()}-${pad(weekStart.getMonth() + 1)}-${pad(weekStart.getDate())}`;
  const groups = [
    {
      name: 'This week',
      rows: rows.filter((row) => row.day >= weekKey),
    },
    {
      name: 'Earlier',
      rows: rows.filter((row) => row.day < weekKey),
    },
  ].filter((group) => group.rows.length);

  const remove = (row: Row) => {
    const removed = deleteThread(row.day);
    showToast({
      text: `${row.title} deleted`,
      tone: 'removed',
      undo: () => restoreThread(removed),
    });
  };

  return (
    <Page
      screen="chat"
      kind="pushed"
      title="Past days"
      trailing={
        editing ? (
          <HeaderIconButton
            testID={tid('chat', 'history', 'edit')}
            accessibilityLabel="Done deleting"
            icon="check"
            active
            onPress={() => setEditing(false)}
          />
        ) : (
          <HeaderIconButton
            testID={tid('chat', 'history', 'edit')}
            accessibilityLabel="Delete days"
            icon="pencil-outline"
            onPress={() => setEditing(true)}
          />
        )
      }
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        <SearchField
          testID={tid('chat', 'history', 'search')}
          accessibilityLabel="Search past days"
          placeholder="Search a day, shop or amount"
          value={query}
          onChangeText={setQuery}
        />

        {groups.map((group) => (
          <ListSection
            key={group.name}
            label={group.name}
          >
            {group.rows.map((row) => (
              <View
                key={row.day}
                className="flex-row items-center"
              >
                <Press
                  testID={tid('chat', 'history', 'day', row.day)}
                  disabled={editing}
                  accessibilityLabel={`${row.title}, ${row.count} messages${row.preview ? `, ${row.preview}` : ''}`}
                  onPress={() =>
                    router.dismissTo({
                      pathname: '/chat',
                      params: { day: row.day },
                    })
                  }
                  className="min-h-[66px] flex-1 flex-row items-center gap-3.5 py-3 pl-[18px] pr-3"
                >
                  <SoftBubble
                    icon={row.topic.icon}
                    tint={row.topic.tint}
                    size={42}
                  />
                  <View className="min-w-0 flex-1">
                    <Text
                      variant="rowTitle"
                      className="text-foreground"
                      numberOfLines={1}
                    >
                      {row.title}
                    </Text>
                    <View className="flex-row items-center gap-1.5">
                      <Text
                        variant="meta"
                        className="text-muted"
                      >
                        {`${row.count} ${row.count === 1 ? 'message' : 'messages'}`}
                      </Text>
                      {row.pill ? (
                        <View
                          className={`h-5 justify-center rounded-full px-2 ${row.pill.tone === 'draft' ? 'bg-pending-fill' : 'bg-primary-muted'}`}
                        >
                          <Text
                            className="text-[12px] font-display-bold"
                            style={{
                              color:
                                row.pill.tone === 'draft'
                                  ? tokens.states.pending
                                  : tokens.states.approved,
                            }}
                          >
                            {row.pill.text}
                          </Text>
                        </View>
                      ) : null}
                      {row.preview ? (
                        <Text
                          variant="meta"
                          className="min-w-0 flex-1 text-muted"
                          numberOfLines={1}
                        >
                          {`· ${row.preview}`}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {editing ? null : (
                    <IconSymbol
                      name="chevron-right"
                      size={20}
                      color={tokens.muted}
                    />
                  )}
                </Press>
                {editing ? (
                  <Press
                    testID={tid('chat', 'history', 'delete', row.day)}
                    accessibilityLabel={`Delete ${row.title}`}
                    onPress={() => remove(row)}
                    pressedClassName="bg-destructive-pressed"
                    className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-destructive-fill"
                  >
                    <IconSymbol
                      name="trash-can-outline"
                      size={20}
                      color={tokens.states.destructive}
                    />
                  </Press>
                ) : null}
              </View>
            ))}
          </ListSection>
        ))}

        {groups.length === 0 ? (
          <View className="gap-1 rounded-tile border-[1.5px] border-dashed border-hairline p-[18px]">
            <Text
              variant="rowTitle"
              className="text-foreground"
            >
              {query ? 'No days match' : 'No past days yet'}
            </Text>
            <Text
              variant="body"
              className="text-ink-2"
            >
              {query
                ? 'Try a day, a shop, a category or an amount.'
                : 'Each day with Moni gets its own thread here.'}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Page>
  );
}
