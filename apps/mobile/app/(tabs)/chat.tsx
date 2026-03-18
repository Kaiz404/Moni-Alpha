import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { randomUUID } from 'expo-crypto';
import { streamText } from 'ai';

const TAG = '[Moni/Chat]';

import { useLlamaModel } from '@/hooks/use-llama-model';
import { createFinanceTools, type PendingTransaction } from '@/lib/ai/tools';
import { FINANCE_SYSTEM_PROMPT } from '@/lib/ai/system-prompt';
import { createTransaction } from '@/lib/supabase/transactions';

// ─── Message types ────────────────────────────────────────────────────────────

type UserMessage = {
  id: string;
  role: 'user';
  content: string;
};

type AssistantMessage = {
  id: string;
  role: 'assistant';
  content: string;
  isStreaming?: boolean;
};

type ConfirmationMessage = {
  id: string;
  role: 'confirmation';
  transaction: PendingTransaction;
  status: 'pending' | 'confirmed' | 'cancelled';
};

type DisplayMessage = UserMessage | AssistantMessage | ConfirmationMessage;

type AiHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { model, status, downloadProgress, error, downloadAndPrepare } =
    useLlamaModel();

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [aiHistory, setAiHistory] = useState<AiHistoryMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const isReady = status === 'ready';

  // ── Send handler ────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !model || isSending) return;

    console.log(TAG, '── handleSend ──────────────────────────');
    console.log(TAG, 'user input:', text);
    console.log(TAG, 'model ref:', model ? 'present' : 'null');
    console.log(TAG, 'conversation history length:', aiHistory.length);

    setInput('');
    setIsSending(true);

    const userMsg: UserMessage = { id: randomUUID(), role: 'user', content: text };
    const assistantId = randomUUID();
    const assistantMsg: AssistantMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    // `any[]` because mid-loop messages include tool-call / tool-result roles
    // that aren't in the simple AiHistoryMessage type.
    const currentMessages: any[] = [
      ...aiHistory,
      { role: 'user', content: text },
    ];

    // Tools are created fresh per request so the closure captures the current
    // setMessages without needing an additional ref.
    const tools = createFinanceTools((tx: PendingTransaction) => {
      console.log(TAG, 'onPropose fired → inserting confirmation card');
      const confirmMsg: ConfirmationMessage = {
        id: randomUUID(),
        role: 'confirmation',
        transaction: tx,
        status: 'pending',
      };
      setMessages((prev) => {
        const assistantIdx = prev.findIndex((m) => m.id === assistantId);
        if (assistantIdx === -1) return [...prev, confirmMsg];
        const next = [...prev];
        next.splice(assistantIdx, 0, confirmMsg);
        return next;
      });
    });

    try {
      // ── Manual agentic loop ──────────────────────────────────────────────────
      // maxSteps is not supported by this AI SDK build on streamText, so we
      // drive the tool-call → result → continue cycle ourselves.
      const MAX_STEPS = 6;
      let fullText = '';
      let deltaCount = 0;
      let loggedTextDeltaKeys = false;
      let loggedToolCallKeys = false;
      let loggedToolResultKeys = false;

      for (let step = 1; step <= MAX_STEPS; step++) {
        console.log(TAG, `\n─── agentic step ${step}/${MAX_STEPS} ──────────────`);
        console.log(TAG, `messages going in: ${currentMessages.length}`);

        const stepToolCalls: any[] = [];
        const stepToolResults: any[] = [];
        let stepFinishReason = 'stop';

        const result = streamText({
          model,
          system: FINANCE_SYSTEM_PROMPT,
          messages: currentMessages,
          tools,
        } as any);

        for await (const part of (result as any).fullStream) {
          switch (part.type) {
            case 'text-delta': {
              const delta: string =
                part.textDelta ?? part.delta ?? part.text ?? '';
              if (!loggedTextDeltaKeys) {
                console.log(TAG, 'text-delta keys:', Object.keys(part), '→ value:', JSON.stringify(delta));
                loggedTextDeltaKeys = true;
              }
              fullText += delta;
              deltaCount++;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? ({ ...m, content: fullText } as AssistantMessage)
                    : m,
                ),
              );
              break;
            }

            case 'tool-call': {
              if (!loggedToolCallKeys) {
                console.log(TAG, 'tool-call keys:', Object.keys(part));
                console.log(TAG, 'tool-call full:', JSON.stringify(part));
                loggedToolCallKeys = true;
              }
              const name = part.toolName ?? part.name ?? '?';
              const args = part.args ?? part.input ?? part.parameters ?? {};
              console.log(TAG, `🔧 tool-call: ${name}`, JSON.stringify(args));
              stepToolCalls.push(part);
              break;
            }

            case 'tool-result': {
              if (!loggedToolResultKeys) {
                console.log(TAG, 'tool-result keys:', Object.keys(part));
                console.log(TAG, 'tool-result full (truncated):', JSON.stringify(part).slice(0, 400));
                loggedToolResultKeys = true;
              }
              const resolved = part.result ?? part.output ?? part.toolResult ?? part.content;
              const name = part.toolName ?? part.name ?? '?';
              console.log(
                TAG,
                `✅ tool-result: ${name}`,
                Array.isArray(resolved) ? `(${resolved.length} items)` : JSON.stringify(resolved)?.slice(0, 150),
              );
              stepToolResults.push({ ...part, _resolved: resolved });
              break;
            }

            case 'finish-step':
            case 'step-finish':
              stepFinishReason = part.finishReason ?? stepFinishReason;
              console.log(TAG, `■ step-finish: ${part.finishReason}`);
              break;

            case 'finish':
              // Only update if we haven't already got a tool-calls finish reason
              if (stepFinishReason !== 'tool-calls') {
                stepFinishReason = part.finishReason ?? stepFinishReason;
              }
              console.log(TAG, `🏁 finish: ${part.finishReason}`, JSON.stringify(part.usage ?? {}));
              break;

            case 'error':
              console.error(TAG, '❌ stream error event:', part.error);
              break;

            case 'start':
            case 'step-start':
            case 'start-step':
              break; // noise — ignore

            default:
              console.log(TAG, `other event: ${part.type}`);
          }
        }

        console.log(TAG, `step ${step} done – finish: "${stepFinishReason}", text so far: ${fullText.length} chars, toolCalls: ${stepToolCalls.length}`);

        // If the model finished normally (stop / length / etc.), we're done
        if (stepFinishReason !== 'tool-calls' || stepToolCalls.length === 0) {
          break;
        }

        // ── The model made tool calls but has more to say; build history ──────
        // First try result.response (AI SDK v4 style) to get the canonically
        // formatted messages — avoids us having to guess property names.
        let appendedViaResponse = false;
        try {
          const response = await (result as any).response;
          const responseMessages: any[] = response?.messages ?? [];
          if (responseMessages.length > 0) {
            console.log(TAG, `appending ${responseMessages.length} messages from result.response`);
            currentMessages.push(...responseMessages);
            appendedViaResponse = true;
          }
        } catch {
          // result.response doesn't exist in this SDK build
        }

        if (!appendedViaResponse) {
          // Fallback: manually construct assistant (tool-calls) + tool messages.
          // Property names are probed with fallbacks to handle SDK version differences.
          const getId = (p: any, i: number) =>
            p.toolCallId ?? p.id ?? p.toolUseId ?? `call-${step}-${i}`;
          const getName = (p: any) => p.toolName ?? p.name ?? 'tool';
          const getArgs = (p: any) => p.args ?? p.input ?? p.parameters ?? {};

          const toolCallParts = stepToolCalls.map((tc, i) => ({
            type: 'tool-call' as const,
            toolCallId: getId(tc, i),
            toolName: getName(tc),
            args: getArgs(tc),
          }));

          const toolResultParts = stepToolResults.map((tr, i) => ({
            type: 'tool-result' as const,
            toolCallId: getId(tr, i),
            toolName: getName(tr),
            result: tr._resolved,
          }));

          console.log(TAG, 'manually appending tool-call + tool-result messages');
          console.log(TAG, 'toolCallParts:', JSON.stringify(toolCallParts));
          console.log(TAG, 'toolResultParts (truncated):', JSON.stringify(toolResultParts).slice(0, 400));

          currentMessages.push(
            { role: 'assistant', content: toolCallParts },
            { role: 'tool', content: toolResultParts },
          );
        }
      }
      // ── End agentic loop ─────────────────────────────────────────────────────

      console.log(TAG, `all steps done – ${deltaCount} deltas, ${fullText.length} chars total`);
      console.log(TAG, 'final text:', fullText.slice(0, 200) + (fullText.length > 200 ? '…' : ''));

      if (fullText.trim() === '') {
        console.log(TAG, 'no text – removing empty assistant bubble');
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? ({ ...m, isStreaming: false } as AssistantMessage)
              : m,
          ),
        );
      }

      // Persist a simplified (text-only) history for future turns
      setAiHistory([
        ...aiHistory,
        { role: 'user', content: text },
        ...(fullText.trim() ? [{ role: 'assistant' as const, content: fullText }] : []),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(TAG, '❌ handleSend caught error:', msg, err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? ({ ...m, content: `Error: ${msg}`, isStreaming: false } as AssistantMessage)
            : m,
        ),
      );
    } finally {
      setIsSending(false);
      console.log(TAG, '── handleSend done ─────────────────────');
    }
  }, [input, model, isSending, aiHistory]);

  // ── Confirmation handlers ───────────────────────────────────────────────────

  const handleConfirm = useCallback(
    async (msgId: string, transaction: PendingTransaction) => {
      console.log(TAG, 'handleConfirm – saving transaction:', JSON.stringify(transaction, null, 2));
      try {
        const saved = await createTransaction({
          walletId: transaction.walletId,
          amount: transaction.amount,
          type: transaction.type,
          merchant: transaction.merchant,
          description: transaction.description,
          categoryId: transaction.categoryId,
          transactionDate: transaction.transactionDate,
        });
        console.log(TAG, '✅ transaction saved, id:', saved.id);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? ({ ...m, status: 'confirmed' } as ConfirmationMessage)
              : m,
          ),
        );
      } catch (err) {
        console.error(TAG, '❌ createTransaction failed:', err);
        Alert.alert('Error', 'Failed to save the transaction. Please try again.');
      }
    },
    [],
  );

  const handleCancel = useCallback((msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? ({ ...m, status: 'cancelled' } as ConfirmationMessage)
          : m,
      ),
    );
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (
    status === 'not-downloaded' ||
    status === 'checking' ||
    status === 'downloading' ||
    status === 'preparing'
  ) {
    return <ModelSetupScreen
      status={status}
      downloadProgress={downloadProgress}
      error={error}
      onDownload={downloadAndPrepare}
    />;
  }

  if (status === 'error') {
    return <ModelErrorScreen error={error} onRetry={downloadAndPrepare} />;
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-gray-900"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageItem
            message={item}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<EmptyState />}
      />

      <View className="flex-row items-end px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <TextInput
          className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 text-base text-gray-900 dark:text-white mr-3"
          style={{ maxHeight: 112 }}
          placeholder="Message Moni…"
          placeholderTextColor="#9CA3AF"
          value={input}
          onChangeText={setInput}
          multiline
          editable={isReady && !isSending}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          className={`w-11 h-11 rounded-full items-center justify-center ${
            isReady && input.trim() && !isSending
              ? 'bg-blue-600'
              : 'bg-gray-300 dark:bg-gray-600'
          }`}
          onPress={handleSend}
          disabled={!isReady || !input.trim() || isSending}
          activeOpacity={0.7}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white text-lg font-bold">↑</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function MessageItem({
  message,
  onConfirm,
  onCancel,
}: {
  message: DisplayMessage;
  onConfirm: (id: string, tx: PendingTransaction) => void;
  onCancel: (id: string) => void;
}) {
  if (message.role === 'confirmation') {
    return (
      <ConfirmationCard
        message={message}
        onConfirm={() => onConfirm(message.id, message.transaction)}
        onCancel={() => onCancel(message.id)}
      />
    );
  }

  const isUser = message.role === 'user';
  return (
    <View className={`flex-row mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <View className="w-8 h-8 rounded-full bg-blue-600 items-center justify-center mr-2 mt-0.5">
          <Text className="text-white text-xs font-bold">M</Text>
        </View>
      )}
      <View
        className={`rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 rounded-tr-sm'
            : 'bg-gray-100 dark:bg-gray-800 rounded-tl-sm'
        }`}
        style={{ maxWidth: '78%' }}
      >
        <Text
          className={`text-base leading-6 ${
            isUser ? 'text-white' : 'text-gray-900 dark:text-white'
          }`}
        >
          {message.content}
        </Text>
        {message.role === 'assistant' && message.isStreaming && (
          <View className="flex-row items-center mt-1.5">
            <View className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-1 opacity-60" />
            <View className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-1 opacity-80" />
            <View className="w-1.5 h-1.5 rounded-full bg-gray-400 opacity-100" />
          </View>
        )}
      </View>
    </View>
  );
}

function ConfirmationCard({
  message,
  onConfirm,
  onCancel,
}: {
  message: ConfirmationMessage;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { transaction, status } = message;
  const isExpense = transaction.type === 'expense';
  const isIncome = transaction.type === 'income';

  const typeEmoji = isExpense ? '💸' : isIncome ? '💰' : '🔄';
  const amountColor = isExpense
    ? 'text-red-600 dark:text-red-400'
    : 'text-green-600 dark:text-green-400';
  const amountPrefix = isExpense ? '−' : '+';

  const statusBadge = {
    pending: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
    confirmed: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
    cancelled: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  }[status];

  const statusLabel = {
    pending: 'Awaiting confirmation',
    confirmed: '✓ Saved',
    cancelled: 'Cancelled',
  }[status];

  const rows: { label: string; value: string; valueClass?: string }[] = [
    {
      label: 'Amount',
      value: `${amountPrefix}$${transaction.amount.toFixed(2)}`,
      valueClass: `font-semibold ${amountColor}`,
    },
    { label: 'Wallet', value: transaction.walletName },
    ...(transaction.merchant ? [{ label: 'Merchant', value: transaction.merchant }] : []),
    ...(transaction.description ? [{ label: 'Note', value: transaction.description }] : []),
    {
      label: 'Type',
      value: transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1),
    },
    {
      label: 'Date',
      value: new Date(transaction.transactionDate ?? Date.now()).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    },
  ];

  return (
    <View className="mb-4 mt-1">
      <View className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mx-2">
        {/* Header */}
        <View className="flex-row items-center mb-3">
          <Text className="text-xl mr-2">{typeEmoji}</Text>
          <Text className="font-semibold text-gray-900 dark:text-white text-base flex-1">
            Transaction Proposal
          </Text>
          <View className={`px-2 py-0.5 rounded-full ${statusBadge}`}>
            <Text className="text-xs font-medium">{statusLabel}</Text>
          </View>
        </View>

        {/* Details */}
        <View className="mb-4">
          {rows.map(({ label, value, valueClass }) => (
            <View key={label} className="flex-row justify-between mb-1.5">
              <Text className="text-gray-500 dark:text-gray-400 text-sm">{label}</Text>
              <Text
                className={`text-gray-900 dark:text-white text-sm text-right ml-4 shrink ${
                  valueClass ?? ''
                }`}
                style={{ maxWidth: '60%' }}
                numberOfLines={3}
              >
                {value}
              </Text>
            </View>
          ))}
        </View>

        {/* Action buttons — only shown while pending */}
        {status === 'pending' && (
          <View className="flex-row">
            <TouchableOpacity
              className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl py-3 items-center mr-2"
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text className="text-gray-700 dark:text-gray-300 font-medium text-sm">
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-blue-600 rounded-xl py-3 items-center"
              onPress={onConfirm}
              activeOpacity={0.7}
            >
              <Text className="text-white font-semibold text-sm">Confirm & Save</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'confirmed' && (
          <View className="flex-row items-center justify-center py-1">
            <Text className="text-green-600 dark:text-green-400 text-sm font-medium">
              Transaction saved successfully
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function EmptyState() {
  const suggestions = [
    'Log a $45 expense at Whole Foods',
    'Show my recent transactions',
    'What are my wallet balances?',
    'Add a $2500 salary income',
  ];

  return (
    <View className="py-12 px-4 items-center">
      <View className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-950 items-center justify-center mb-4">
        <Text className="text-3xl">💬</Text>
      </View>
      <Text className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        {"Hi, I'm Moni"}
      </Text>
      <Text className="text-gray-500 dark:text-gray-400 text-center text-sm mb-8 leading-5">
        Your on-device finance assistant. I can help you log transactions, review spending, and check your balances.
      </Text>
      <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
        Try asking
      </Text>
      <View className="w-full">
        {suggestions.map((s) => (
          <View
            key={s}
            className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 mb-2"
          >
            <Text className="text-gray-700 dark:text-gray-300 text-sm">{s}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ModelSetupScreen({
  status,
  downloadProgress,
  error,
  onDownload,
}: {
  status: string;
  downloadProgress: number;
  error: string | null;
  onDownload: () => void;
}) {
  const isLoading =
    status === 'downloading' || status === 'preparing' || status === 'checking';

  return (
    <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center px-8">
      <View className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-950 items-center justify-center mb-6">
        <Text className="text-4xl">🤖</Text>
      </View>
      <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
        AI Finance Assistant
      </Text>
      <Text className="text-gray-500 dark:text-gray-400 text-center text-sm leading-5 mb-8">
        Chat with an on-device model to log transactions, review spending, and get financial insights — all privately on your device.
      </Text>

      {isLoading ? (
        <View className="items-center w-full">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="text-blue-600 dark:text-blue-400 font-medium mt-4 text-center">
            {status === 'downloading'
              ? `Downloading… ${downloadProgress}%`
              : status === 'preparing'
              ? 'Loading model into memory…'
              : 'Checking…'}
          </Text>
          {status === 'downloading' && (
            <View className="w-full mt-3">
              <View className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <View
                  className="h-2 bg-blue-600 rounded-full"
                  style={{ width: `${downloadProgress}%` }}
                />
              </View>
              <Text className="text-gray-400 dark:text-gray-500 text-xs text-center mt-1.5">
                ~1.9 GB · stored on your device
              </Text>
            </View>
          )}
        </View>
      ) : (
        <>
          <View className="w-full bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 mb-6">
            {[
              { label: 'Model', value: 'Qwen 2.5 3B Instruct (Q3)' },
              { label: 'Size', value: '~1.9 GB' },
              { label: 'Privacy', value: 'Runs entirely on your device' },
              { label: 'Requires', value: 'One-time download' },
            ].map(({ label, value }) => (
              <View key={label} className="flex-row justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <Text className="text-gray-500 dark:text-gray-400 text-sm">{label}</Text>
                <Text className="text-gray-900 dark:text-white text-sm font-medium">{value}</Text>
              </View>
            ))}
          </View>

          {error && (
            <Text className="text-red-500 text-sm text-center mb-4">{error}</Text>
          )}

          <TouchableOpacity
            className="bg-blue-600 w-full py-4 rounded-2xl items-center"
            onPress={onDownload}
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-base">
              Download & Set Up Model
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function ModelErrorScreen({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center px-8">
      <Text className="text-5xl mb-4">⚠️</Text>
      <Text className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        Failed to Load Model
      </Text>
      <Text className="text-gray-500 dark:text-gray-400 text-center text-sm mb-6 leading-5">
        {error ?? 'An unexpected error occurred while loading the AI model.'}
      </Text>
      <TouchableOpacity
        className="bg-blue-600 px-8 py-4 rounded-2xl"
        onPress={onRetry}
        activeOpacity={0.8}
      >
        <Text className="text-white font-semibold">Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}
