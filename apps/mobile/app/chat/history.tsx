import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
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
  type ChatThread,
} from '@/lib/ai/chat/messages';
import { todayThreadDay } from '@/lib/ai/chat/sessions';
import { formatDate } from '@/lib/dates/day-label';
import { parseLocalDateInput } from '@/lib/dates/local-date-input';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';

type Row = {
  day: string;
  title: string;
  count: number;
  pill: { text: string; tone: 'draft' | 'added' } | null;
  preview: string;
  searchText: string;
};

function toRow(thread: ChatThread, now: Date): Row {
  const date = parseLocalDateInput(thread.day) ?? now;
  const title = thread.day === todayThreadDay(now) ? 'Today' : formatDate(date, now);
  const talk = thread.messages.filter(
    (m) => m.kind !== 'assistant_status' && m.kind !== 'assistant_noticed',
  );
  const drafts = thread.messages.filter((m) => m.kind === 'assistant_draft');
  const open = drafts.filter((m) => !m.outcome).length;
  const added = drafts.find((m) => m.outcome?.kind === 'approved');
  const lastUser = [...thread.messages].reverse().find((m) => m.role === 'user');
  const words = thread.messages
    .map((m) => {
      if ('content' in m) return m.content;
      if (m.kind === 'assistant_draft') return m.outcome?.title ?? '';
      return '';
    })
    .join(' ');
  return {
    day: thread.day,
    title,
    count: talk.length,
    pill: open
      ? { text: `${open} ${open === 1 ? 'draft' : 'drafts'}`, tone: 'draft' }
      : added?.kind === 'assistant_draft' && added.outcome
        ? { text: `Added ${added.outcome.title.split(' ').at(-1)}`, tone: 'added' }
        : null,
    preview: lastUser && 'content' in lastUser ? lastUser.content : '',
    searchText: `${title} ${formatDate(date, now)} ${words}`.toLowerCase(),
  };
}

/** V2H-ChatHistory: one row per past day, with search and delete with Undo. */
export default function ChatHistoryScreen() {
  const tokens = useThemeTokens();
  const [threads, setThreads] = useState(listThreads);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => subscribeThreads(() => setThreads(listThreads())), []);

  const now = new Date();
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads
      .map((thread) => toRow(thread, now))
      .filter((row) => !q || row.searchText.includes(q));
    // `now` only labels days; the list follows the threads and the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, query]);

  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const pad = (n: number) => String(n).padStart(2, '0');
  const weekKey = `${weekStart.getFullYear()}-${pad(weekStart.getMonth() + 1)}-${pad(weekStart.getDate())}`;
  const groups = [
    { name: 'This week', rows: rows.filter((row) => row.day >= weekKey) },
    { name: 'Earlier', rows: rows.filter((row) => row.day < weekKey) },
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
        <HeaderIconButton
          testID={tid('chat', 'history', 'edit')}
          accessibilityLabel={editing ? 'Done deleting' : 'Delete days'}
          icon={editing ? 'check' : 'pencil-outline'}
          onPress={() => setEditing((on) => !on)}
        />
      }
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-10"
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
          <View
            key={group.name}
            className="gap-2.5"
          >
            <Text
              variant="caps"
              className="pl-1 text-muted"
              accessibilityRole="header"
            >
              {group.name}
            </Text>
            <ListCard>
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
                      router.dismissTo({ pathname: '/chat', params: { day: row.day } })
                    }
                    className="min-h-[66px] flex-1 flex-row items-center gap-3.5 py-3 pl-[18px] pr-3"
                  >
                    <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-lilac">
                      <IconSymbol
                        name="creation"
                        size={20}
                        color={tokens.onPastel}
                      />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text
                        variant="rowTitle"
                        className="text-foreground"
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
                            className={`h-5 justify-center rounded-full px-2 ${row.pill.tone === 'draft' ? 'bg-lilac' : 'bg-mint'}`}
                          >
                            <Text className="text-[12px] font-display-bold text-on-pastel">
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
                        color={tokens.over}
                      />
                    </Press>
                  ) : null}
                </View>
              ))}
            </ListCard>
          </View>
        ))}

        {groups.length === 0 ? (
          <View className="items-center gap-1 py-10">
            <Text
              variant="cardTitle"
              className="text-foreground"
            >
              {query ? 'No days match' : 'No past days yet'}
            </Text>
            <Text
              variant="body"
              className="text-center text-ink-2"
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
