import { useValue } from '@legendapp/state/react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatInputBar } from '@/components/chat/chat-input-bar';
import { chatTime } from '@/components/chat/chat-time';
import { MeetMoni } from '@/components/chat/meet-moni';
import { MessageBubble } from '@/components/chat/message-bubble';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Page } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { buildAnswerSnapshot } from '@/lib/ai/chat/answer-snapshot';
import {
  appendMessage,
  listThreads,
  readThread,
  readTodayThread,
  subscribeThreads,
  type ChatMessage,
  type NoticedItem,
  type QuickReplyOption,
} from '@/lib/ai/chat/messages';
import { noticedItems } from '@/lib/ai/chat/noticed';
import { handleQuickReply, sendChatMessage } from '@/lib/ai/chat/orchestrator';
import { todayThreadDay } from '@/lib/ai/chat/sessions';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate } from '@/lib/dates/day-label';
import { parseLocalDateInput } from '@/lib/dates/local-date-input';
import { pendingProposals$ } from '@/lib/finance/selectors';
import { scanAndNormalizeReceipt } from '@/lib/receipts/scan-receipt';
import {
  buildSpeechRecognitionOptions,
  ensureSpeechPermissions,
  getTranscriptFromResult,
  mergeTranscriptWithBase,
  prepareOfflineSpeechModel,
} from '@/lib/speech/speech-recognition';
import { isAwaitingReview } from '@/lib/supabase/proposed-transactions';
import { tid } from '@/lib/test-ids';

/** Messages shown under "Earlier today" stay folded beyond these last few. */
const SHOWN_ON_OPEN = 4;

function dayTitle(day: string, now: Date): string {
  const date = parseLocalDateInput(day) ?? now;
  return day === todayThreadDay(now) ? `Today · ${formatDate(date, now)}` : formatDate(date, now);
}

export default function ChatScreen() {
  const tokens = useThemeTokens();
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ draft?: string; day?: string }>();
  const today = todayThreadDay();
  const [viewDay, setViewDay] = useState(params.day ?? today);
  const isToday = viewDay === today;
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    viewDay === today ? readTodayThread().messages : readThread(viewDay).messages,
  );
  const [firstRun] = useState(() => listThreads().length === 0);
  const folded = useRef(Math.max(0, messages.length - SHOWN_ON_OPEN));
  const [unfolded, setUnfolded] = useState(false);
  const [input, setInput] = useState(params.draft ?? '');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const proposals = useValue(pendingProposals$(user?.id ?? null));

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef(input);
  inputRef.current = input;
  const speechBase = useRef('');
  const sendOnEnd = useRef(false);

  useEffect(() => {
    setMessages(readThread(viewDay).messages);
    return subscribeThreads((day) => {
      if (day === viewDay) setMessages(readThread(day).messages);
    });
  }, [viewDay]);

  useEffect(() => {
    if (params.draft) setInput(params.draft);
  }, [params.draft]);

  useEffect(() => {
    if (params.day) setViewDay(params.day);
  }, [params.day]);

  // "Moni noticed" opens today's thread once a day, when something stands out.
  useEffect(() => {
    const userId = user?.id;
    if (!userId || !isToday || firstRun) return;
    if (readThread(today).messages.some((m) => m.kind === 'assistant_noticed')) return;
    const now = new Date();
    const waiting = pendingProposals$(userId)
      .peek()
      .filter((proposal) => isAwaitingReview(proposal, now));
    const snapshot = buildAnswerSnapshot(userId, now);
    const items = noticedItems(
      snapshot,
      {
        count: waiting.length,
        amount: waiting
          .filter((proposal) => proposal.currency === snapshot.currency)
          .reduce((sum, proposal) => sum + Number(proposal.amountMinor ?? 0), 0),
      },
      now,
    );
    if (items.length)
      appendMessage({
        id: `noticed-${today}`,
        role: 'assistant',
        kind: 'assistant_noticed',
        items,
        createdAt: now.toISOString(),
      });
  }, [user?.id, isToday, firstRun, today]);

  const send = useCallback(
    (text: string) => {
      const image = attachedImage;
      if (!text.trim() && !image) return;
      setInput('');
      setAttachedImage(null);
      setViewDay(todayThreadDay());
      void sendChatMessage({ text, imageUri: image }).catch((error) =>
        console.warn('[chat] send failed', error),
      );
    },
    [attachedImage],
  );

  useSpeechRecognitionEvent('result', (event: ExpoSpeechRecognitionResultEvent) => {
    const text = getTranscriptFromResult(event);
    if (text) setInput(mergeTranscriptWithBase(speechBase.current, text));
  });
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    if (sendOnEnd.current) {
      sendOnEnd.current = false;
      send(inputRef.current);
    }
  });
  useSpeechRecognitionEvent('error', () => {
    sendOnEnd.current = false;
    setListening(false);
  });

  const listen = async () => {
    try {
      if (!(await ensureSpeechPermissions())) return;
      await prepareOfflineSpeechModel({ allowDialog: true });
      speechBase.current = input;
      setListening(true);
      ExpoSpeechRecognitionModule.start(buildSpeechRecognitionOptions());
    } catch {
      setListening(false);
    }
  };

  const onQuickReply = (option: QuickReplyOption, message: ChatMessage) => {
    if (message.kind !== 'assistant_clarify') return;
    void handleQuickReply(option, message.pendingContext, message.pendingImageUri);
  };

  const onNoticed = (item: NoticedItem) => {
    if (item.target.kind === 'ask') {
      send(item.target.question);
      return;
    }
    const first = proposals.find((proposal) => isAwaitingReview(proposal, new Date()));
    if (first) router.push({ pathname: '/proposal/[id]', params: { id: first.id } });
  };

  const hidden = unfolded ? 0 : Math.min(folded.current, messages.length);
  const shown = messages.slice(hidden);
  const answered = messages.some(
    (m) => m.kind === 'assistant_card' || (m.kind === 'assistant_text' && m.status === 'done'),
  );
  const now = new Date();

  const body = useAnimatedStyle(() => ({
    paddingBottom: Math.max(keyboard.height.get() - insets.bottom, 0),
  }));

  return (
    <Page
      screen="chat"
      kind="pushed"
      title="Moni"
      subtitle={isToday ? `${dayTitle(viewDay, now)} · ${chatTime(now.toISOString())}` : dayTitle(viewDay, now)}
      trailing={
        <HeaderIconButton
          testID={tid('chat', 'history')}
          accessibilityLabel="Past days"
          icon="history"
          onPress={() => router.push('/chat/history')}
        />
      }
    >
      <Animated.View
        className="flex-1"
        style={body}
      >
        <FlatList
          ref={listRef}
          data={shown}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="grow px-5 pb-4 pt-1"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            firstRun && !messages.length ? (
              <MeetMoni
                name={user?.user_metadata?.full_name ?? null}
                onStarter={setInput}
              />
            ) : messages.length ? (
              <View className="mb-3 gap-2">
                <Text
                  variant="caps"
                  className="text-center text-muted"
                >
                  {dayTitle(viewDay, now)}
                </Text>
                {folded.current > 0 ? (
                  <Press
                    testID={tid('chat', 'earlier')}
                    accessibilityState={{ expanded: unfolded }}
                    onPress={() => setUnfolded((open) => !open)}
                    radius={{ rest: 22, pressed: 16 }}
                    pressedClassName="bg-hairline"
                    className="h-11 flex-row items-center gap-2 self-center bg-sand px-4"
                  >
                    <IconSymbol
                      name="clock-outline"
                      size={16}
                      color={tokens.ink2}
                    />
                    <Text
                      variant="meta"
                      className="text-ink-2"
                    >
                      {`Earlier ${isToday ? 'today' : 'this day'} · ${folded.current} ${folded.current === 1 ? 'message' : 'messages'}`}
                    </Text>
                    <IconSymbol
                      name={unfolded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={tokens.ink2}
                    />
                  </Press>
                ) : null}
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              onQuickReply={onQuickReply}
              onNoticed={onNoticed}
            />
          )}
          ListFooterComponent={
            answered ? (
              <Text
                variant="smallest"
                className="mt-2 text-center text-muted"
              >
                Moni can be wrong. Check important numbers.
              </Text>
            ) : null
          }
        />
        <ChatInputBar
          input={input}
          onChangeText={setInput}
          placeholder={firstRun && !messages.length ? 'Try “lunch 12.50 at Mamak Ali”' : 'Ask or add a transaction'}
          attachedImage={attachedImage}
          onRemoveImage={() => setAttachedImage(null)}
          onOpenCamera={() =>
            void scanAndNormalizeReceipt().then((uri) => {
              if (uri) setAttachedImage(uri);
            })
          }
          onSend={() => send(input)}
          listening={listening}
          onListen={() => void listen()}
          onCancelListen={() => {
            sendOnEnd.current = false;
            ExpoSpeechRecognitionModule.abort();
            setInput(speechBase.current);
            setListening(false);
          }}
          onDoneListen={() => {
            sendOnEnd.current = true;
            ExpoSpeechRecognitionModule.stop();
          }}
          bottomInset={0}
        />
      </Animated.View>
    </Page>
  );
}
