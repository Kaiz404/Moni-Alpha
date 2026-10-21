import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import {
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Page } from '@/components/ui/page';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import type { ExpoSpeechRecognitionResultEvent } from 'expo-speech-recognition';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  buildSpeechRecognitionOptions,
  ensureSpeechPermissions,
  getTranscriptFromResult,
  mergeTranscriptWithBase,
  prepareOfflineSpeechModel,
} from '@/lib/speech/speech-recognition';
import { MessageBubble } from '@/components/chat/message-bubble';
import { ConfirmBalanceCard } from '@/components/wallets/confirm-balance-card';
import {
  ChatInputBar,
  ChatEmptyState,
} from '@/components/chat/chat-input-bar';
import type {
  ChatMessage,
  QuickReplyOption,
} from '@/lib/ai/chat/messages';
import {
  handleQuickReply,
  sendChatMessage,
} from '@/lib/ai/chat/orchestrator';
import {
  getOrRefreshSession,
  startNewChatSession,
} from '@/lib/ai/chat/sessions';
import { scanAndNormalizeReceipt } from '@/lib/receipts/scan-receipt';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { tid } from '@/lib/test-ids';

const TAG = '[Moni/Chat]';

export default function ChatScreen() {
  const tokens = useThemeTokens();
  const insets = useSafeAreaInsets();

  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(
    null,
  );
  const [isSpeechRecognizing, setIsSpeechRecognizing] =
    useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const flatListRef = useRef<FlatList>(null);
  const sendGuardRef = useRef(false);
  const speechBaseRef = useRef('');
  const speechActiveRef = useRef(false);

  const refreshSession = useCallback(() => {
    const session = getOrRefreshSession();
    setMessages(session.messages);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshSession();
    }, [refreshSession]),
  );

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  useSpeechRecognitionEvent('start', () => {
    speechActiveRef.current = true;
    setIsSpeechRecognizing(true);
  });

  useSpeechRecognitionEvent('end', () => {
    speechActiveRef.current = false;
    setIsSpeechRecognizing(false);
  });

  useSpeechRecognitionEvent('error', () => {
    speechActiveRef.current = false;
    setIsSpeechRecognizing(false);
  });

  useSpeechRecognitionEvent(
    'result',
    (event: ExpoSpeechRecognitionResultEvent) => {
      const text = getTranscriptFromResult(event);
      if (!text) return;
      setInput(
        mergeTranscriptWithBase(speechBaseRef.current ?? '', text),
      );
    },
  );

  const startSpeech = useCallback(async () => {
    if (speechActiveRef.current) return;
    try {
      const granted = await ensureSpeechPermissions();
      if (!granted) return;

      await prepareOfflineSpeechModel({ allowDialog: true });

      speechBaseRef.current = input;
      speechActiveRef.current = true;
      setIsSpeechRecognizing(true);
      ExpoSpeechRecognitionModule.start(
        buildSpeechRecognitionOptions(),
      );
    } catch {
      speechActiveRef.current = false;
      setIsSpeechRecognizing(false);
    }
  }, [input]);

  const stopSpeech = useCallback(() => {
    if (!speechActiveRef.current) return;
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      speechActiveRef.current = false;
      setIsSpeechRecognizing(false);
    }
  }, []);

  const sessionCallbacks = useCallback(
    () => ({
      onSessionUpdate: ({
        messages: next,
      }: {
        messages: ChatMessage[];
      }) => {
        setMessages(next);
      },
    }),
    [],
  );

  const handleSend = useCallback(() => {
    if (sendGuardRef.current) return;

    const text = input.trim();
    const pickedImage = attachedImage;
    if (!text && !pickedImage) return;

    sendGuardRef.current = true;
    setInput('');
    setAttachedImage(null);

    void sendChatMessage(
      { text, imageUri: pickedImage },
      sessionCallbacks(),
    )
      .catch((e) => {
        console.warn(TAG, 'send failed:', e);
      })
      .finally(() => {
        sendGuardRef.current = false;
      });
  }, [input, attachedImage, sessionCallbacks]);

  const handleNewChat = useCallback(() => {
    const session = startNewChatSession();
    setMessages(session.messages);
    setInput('');
    setAttachedImage(null);
  }, []);

  const handleQuickReplySelect = useCallback(
    (option: QuickReplyOption, message: ChatMessage) => {
      if (!message.pendingContext) return;
      void handleQuickReply(
        option,
        message.pendingContext,
        message.pendingImageUri,
        sessionCallbacks(),
      );
    },
    [sessionCallbacks],
  );

  // The custom tab bar already reserves the system bottom inset; this extra
  // space keeps composer controls comfortably clear of the lowered FAB.
  const bottomPad = 20;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      style={{ flex: 1 }}
    >
      <Page
        screen="chat"
        kind="pushed"
        title="Moni chat"
        trailing={
          <HeaderIconButton
            testID={tid('chat', 'new-thread')}
            accessibilityLabel="Start a new conversation"
            icon="pencil-outline"
            onPress={handleNewChat}
          />
        }
      >
        <View className="flex-1">
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                onQuickReply={handleQuickReplySelect}
              />
            )}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 16,
              flexGrow: 1,
            }}
            ListHeaderComponent={
              <ConfirmBalanceCard className="mb-3" />
            }
            ListEmptyComponent={
              <ChatEmptyState
                primary={tokens.primary}
                onSuggestion={setInput}
              />
            }
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
          />
        </View>

        <ChatInputBar
          input={input}
          onChangeText={setInput}
          attachedImage={attachedImage}
          onRemoveImage={() => setAttachedImage(null)}
          onOpenCamera={() => {
            void (async () => {
              const uri = await scanAndNormalizeReceipt();
              if (uri) setAttachedImage(uri);
            })();
          }}
          onSend={handleSend}
          isSpeechRecognizing={isSpeechRecognizing}
          onPressInMic={startSpeech}
          onPressOutMic={stopSpeech}
          bottomPad={bottomPad}
        />
      </Page>
    </KeyboardAvoidingView>
  );
}
