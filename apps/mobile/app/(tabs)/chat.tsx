import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import {
  View,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
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

  // The custom tab bar already reserves the system bottom inset.
  const bottomPad = 12;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      style={{ flex: 1 }}
    >
      <SafeAreaView
        edges={['top']}
        className="flex-1"
        style={{ flex: 1 }}
      >
        <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
          <Text className="text-2xl font-bold text-foreground">
            Chat
          </Text>
          <Pressable
            onPress={handleNewChat}
            className="rounded-full border border-border bg-card px-3 py-1.5"
            hitSlop={8}
          >
            <Text className="text-sm font-medium text-primary">
              New chat
            </Text>
          </Pressable>
        </View>

        <View className="mt-1 flex-1 overflow-hidden rounded-t-2xl bg-primary-muted">
          <View className="flex-1 rounded-t-2xl bg-background px-3 pt-4 pb-2">
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
                paddingHorizontal: 8,
                paddingBottom: 8,
                flexGrow: 1,
              }}
              ListEmptyComponent={
                <ChatEmptyState primary={tokens.primary} />
              }
              onContentSizeChange={() =>
                flatListRef.current?.scrollToEnd({ animated: true })
              }
            />
          </View>
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
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
