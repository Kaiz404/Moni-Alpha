import React, { useState, useRef, useCallback, useEffect } from 'react';
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

import { useLlamaModel } from '@/hooks/use-llama-model';
import {
  createFinanceTools,
  type PendingTransaction,
  type WalletPickRequest,
  type WalletSeed,
  type CategorySeed,
} from '@/lib/ai/tools';
import { buildFinanceSystemPrompt } from '@/lib/ai/system-prompt';
import { createTransaction } from '@/lib/supabase/transactions';
import { getWallets } from '@/lib/supabase/wallets';
import { getCategories } from '@/lib/supabase/categories';

const TAG = '[Moni/Chat]';
const today = new Date().toISOString().split('T')[0];

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

type WalletPickerMessage = {
  id: string;
  role: 'wallet-picker';
  request: WalletPickRequest;
  status: 'pending' | 'selected';
};

type DisplayMessage = UserMessage | AssistantMessage | ConfirmationMessage | WalletPickerMessage;

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
  const [wallets, setWallets] = useState<WalletSeed[]>([]);
  const [categories, setCategories] = useState<CategorySeed[]>([]);

  const flatListRef = useRef<FlatList>(null);
  const isReady = status === 'ready';

  const loadContextData = useCallback(async () => {
    try {
      const [ws, cats] = await Promise.all([
        getWallets(),
        getCategories(),
      ]);
      setWallets(
        ws.map((w) => ({
          id: w.id,
          name: w.name ?? 'Wallet',
          type: w.type ?? 'other',
          currency: w.currency ?? 'MYR',
          balance: w.currentBalance ?? w.initialBalance ?? 0,
        })),
      );
      setCategories(
        cats.map((c) => ({
          id: c.id,
          name: c.name ?? 'Other',
          type: c.type ?? 'expense',
        })),
      );
    } catch (e) {
      console.warn(TAG, 'loadContextData failed (non-fatal):', e);
    }
  }, []);

  // Load wallets + categories once model is ready
  useEffect(() => {
    if (status === 'ready') {
      loadContextData();
    }
  }, [status, loadContextData]);

  // ── Send handler ────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !model || isSending) return;

    console.log(TAG, '── handleSend ──────────────────────────');
    console.log(TAG, 'user input:', text);

    setInput('');
    setIsSending(true);

    // Refresh wallet/category data so the system prompt is always up to date
    let currentWallets = wallets;
    let currentCategories = categories;
    try {
      const [ws, cats] = await Promise.all([getWallets(), getCategories()]);
      currentWallets = ws.map((w) => ({
        id: w.id,
        name: w.name ?? 'Wallet',
        type: w.type ?? 'other',
        currency: w.currency ?? 'MYR',
        balance: w.currentBalance ?? w.initialBalance ?? 0,
      }));
      currentCategories = cats.map((c) => ({
        id: c.id,
        name: c.name ?? 'Other',
        type: c.type ?? 'expense',
      }));
      setWallets(currentWallets);
      setCategories(currentCategories);
    } catch (e) {
      console.warn(TAG, 'data refresh failed, using cached:', e);
    }

    const systemPrompt = buildFinanceSystemPrompt(currentWallets, currentCategories);

    const userMsg: UserMessage = { id: randomUUID(), role: 'user', content: text };
    const assistantId = randomUUID();
    const assistantMsg: AssistantMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    const currentMessages: any[] = [
      ...aiHistory,
      { role: 'user', content: text },
    ];

    // Track whether create_transaction was called during this turn.
    // If it was, we suppress the assistant text bubble (the card is confirmation enough).
    let transactionProposed = false;

    const tools = createFinanceTools(
      currentWallets,
      (tx: PendingTransaction) => {
        transactionProposed = true;
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
      },
      (req: WalletPickRequest) => {
        console.log(TAG, 'onPickWallet fired → inserting wallet picker card');
        const pickerMsg: WalletPickerMessage = {
          id: randomUUID(),
          role: 'wallet-picker',
          request: req,
          status: 'pending',
        };
        setMessages((prev) => {
          const assistantIdx = prev.findIndex((m) => m.id === assistantId);
          if (assistantIdx === -1) return [...prev, pickerMsg];
          const next = [...prev];
          next.splice(assistantIdx, 0, pickerMsg);
          return next;
        });
      },
    );

    try {
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
          system: systemPrompt,
          messages: currentMessages,
          tools,
        } as any);

        for await (const part of (result as any).fullStream) {
          switch (part.type) {
            case 'text-delta': {
              const delta: string = part.textDelta ?? part.delta ?? part.text ?? '';
              if (!loggedTextDeltaKeys) {
                console.log(TAG, 'text-delta keys:', Object.keys(part), '→ value:', JSON.stringify(delta));
                loggedTextDeltaKeys = true;
              }
              // If transaction was already proposed, discard follow-up text
              if (!transactionProposed) {
                fullText += delta;
                deltaCount++;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? ({ ...m, content: fullText } as AssistantMessage)
                      : m,
                  ),
                );
              }
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
                Array.isArray(resolved)
                  ? `(${resolved.length} items)`
                  : JSON.stringify(resolved)?.slice(0, 150),
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
              break;

            default:
              console.log(TAG, `other event: ${part.type}`);
          }
        }

        console.log(
          TAG,
          `step ${step} done – finish: "${stepFinishReason}", text: ${fullText.length} chars, toolCalls: ${stepToolCalls.length}, transactionProposed: ${transactionProposed}`,
        );

        // After a successful create_transaction call, stop the loop — the card is confirmation enough
        if (transactionProposed) {
          console.log(TAG, 'transaction proposed — ending agentic loop');
          break;
        }

        if (stepFinishReason !== 'tool-calls' || stepToolCalls.length === 0) {
          break;
        }

        // Build history for next step
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
          // result.response unavailable in this SDK build
        }

        if (!appendedViaResponse) {
          const getId = (p: any, i: number) =>
            p.toolCallId ?? p.id ?? p.toolUseId ?? `call-${step}-${i}`;
          const getName = (p: any) => p.toolName ?? p.name ?? 'tool';
          const toolCallParts = stepToolCalls.map((tc, i) => ({
            type: 'tool-call' as const,
            toolCallId: getId(tc, i),
            toolName: getName(tc),
            args: tc.args ?? tc.input ?? tc.parameters ?? {},
          }));
          const toolResultParts = stepToolResults.map((tr, i) => ({
            type: 'tool-result' as const,
            toolCallId: getId(tr, i),
            toolName: getName(tr),
            result: tr._resolved,
          }));

          console.log(TAG, 'manually appending tool-call + tool-result messages');
          currentMessages.push(
            { role: 'assistant', content: toolCallParts },
            { role: 'tool', content: toolResultParts },
          );
        }
      }

      console.log(TAG, `all steps done – ${deltaCount} deltas, ${fullText.length} chars`);

      // Remove the assistant bubble if transaction was proposed (card replaces it)
      // or if there was no text generated at all
      if (transactionProposed || fullText.trim() === '') {
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

      // Persist text-only history for future turns (skip if we just did a tool-only turn)
      setAiHistory([
        ...aiHistory,
        { role: 'user', content: text },
        ...(fullText.trim() && !transactionProposed
          ? [{ role: 'assistant' as const, content: fullText }]
          : []),
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
  }, [input, model, isSending, aiHistory, wallets, categories]);

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
            m.id === msgId ? ({ ...m, status: 'confirmed' } as ConfirmationMessage) : m,
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
        m.id === msgId ? ({ ...m, status: 'cancelled' } as ConfirmationMessage) : m,
      ),
    );
  }, []);

  const handleWalletPick = useCallback(
    async (msgId: string, walletId: string, walletName: string, req: WalletPickRequest) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? ({ ...m, status: 'selected' } as WalletPickerMessage) : m,
        ),
      );

      const tx: PendingTransaction = {
        walletId,
        walletName,
        amount: req.pendingData.amount,
        type: req.pendingData.type,
        description: req.pendingData.description ?? null,
        merchant: req.pendingData.merchant ?? null,
        categoryId: req.pendingData.categoryId ?? null,
        transactionDate: req.pendingData.transactionDate ?? new Date().toISOString(),
      };

      const confirmMsg: ConfirmationMessage = {
        id: randomUUID(),
        role: 'confirmation',
        transaction: tx,
        status: 'pending',
      };

      setMessages((prev) => {
        const pickerIdx = prev.findIndex((m) => m.id === msgId);
        const next = [...prev];
        next.splice(pickerIdx + 1, 0, confirmMsg);
        return next;
      });
    },
    [],
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  if (
    status === 'not-downloaded' ||
    status === 'checking' ||
    status === 'downloading' ||
    status === 'preparing'
  ) {
    return (
      <ModelSetupScreen
        status={status}
        downloadProgress={downloadProgress}
        error={error}
        onDownload={downloadAndPrepare}
      />
    );
  }

  if (status === 'error') {
    return <ModelErrorScreen error={error} onRetry={downloadAndPrepare} />;
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-gray-900"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
            onWalletPick={handleWalletPick}
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
  onWalletPick,
}: {
  message: DisplayMessage;
  onConfirm: (id: string, tx: PendingTransaction) => void;
  onCancel: (id: string) => void;
  onWalletPick: (msgId: string, walletId: string, walletName: string, req: WalletPickRequest) => void;
}) {
  if (message.role === 'confirmation') {
    return (
      <ConfirmationCard
        message={message}
        onConfirm={(editedTx) => onConfirm(message.id, editedTx)}
        onCancel={() => onCancel(message.id)}
      />
    );
  }

  if (message.role === 'wallet-picker') {
    return (
      <WalletPickerCard
        message={message}
        onPick={(walletId, walletName) =>
          onWalletPick(message.id, walletId, walletName, message.request)
        }
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

function WalletPickerCard({
  message,
  onPick,
}: {
  message: WalletPickerMessage;
  onPick: (walletId: string, walletName: string) => void;
}) {
  const { request, status } = message;
  const walletTypeIcon: Record<string, string> = {
    bank: '🏦',
    cash: '💵',
    credit: '💳',
    debit: '💳',
    ewallet: '📱',
    investment: '📈',
    other: '👛',
  };

  if (status === 'selected') {
    return (
      <View className="mb-4 mt-1 mx-2">
        <View className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 flex-row items-center">
          <Text className="text-gray-400 dark:text-gray-500 text-sm">Wallet selected ✓</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="mb-4 mt-1">
      <View className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mx-2">
        <View className="flex-row items-center mb-3">
          <Text className="text-xl mr-2">👛</Text>
          <Text className="font-semibold text-gray-900 dark:text-white text-base flex-1">
            {request.prompt}
          </Text>
        </View>
        <View>
          {request.wallets.map((w) => (
            <TouchableOpacity
              key={w.id}
              className="flex-row items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 mb-2 active:opacity-70"
              onPress={() => onPick(w.id, w.name)}
              activeOpacity={0.7}
            >
              <Text className="text-xl mr-3">{walletTypeIcon[w.type] ?? '👛'}</Text>
              <View className="flex-1">
                <Text className="text-gray-900 dark:text-white font-medium text-sm">
                  {w.name}
                </Text>
                <Text className="text-gray-400 dark:text-gray-500 text-xs capitalize">
                  {w.type} · {w.currency}
                </Text>
              </View>
              <Text className="text-blue-600 dark:text-blue-400 font-semibold text-sm">
                {w.balance >= 0 ? '+' : ''}
                {w.balance.toFixed(2)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const TX_TYPES = ['expense', 'income', 'transfer'] as const;
type TxType = (typeof TX_TYPES)[number];

function ConfirmationCard({
  message,
  onConfirm,
  onCancel,
}: {
  message: ConfirmationMessage;
  onConfirm: (tx: PendingTransaction) => void;
  onCancel: () => void;
}) {
  const { transaction, status } = message;
  const isPending = status === 'pending';

  // Local editable state — only meaningful while pending
  const [txType, setTxType] = useState<TxType>(transaction.type as TxType);
  const [amount, setAmount] = useState(transaction.amount.toFixed(2));
  const [merchant, setMerchant] = useState(transaction.merchant ?? '');
  const [description, setDescription] = useState(transaction.description ?? '');
  const [date, setDate] = useState(
    transaction.transactionDate
      ? new Date(transaction.transactionDate).toISOString().split('T')[0]
      : today,
  );

  const isExpense = txType === 'expense';
  const isIncome = txType === 'income';
  const typeEmoji = isExpense ? '💸' : isIncome ? '💰' : '🔄';
  const amountColor = isExpense ? '#DC2626' : '#16A34A';

  const statusBadge = {
    pending: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
    confirmed: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
    cancelled: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  }[status];

  const statusLabel = {
    pending: 'Tap to edit · confirm when ready',
    confirmed: '✓ Saved',
    cancelled: 'Cancelled',
  }[status];

  const handleConfirm = () => {
    const parsedAmount = parseFloat(amount);
    onConfirm({
      ...transaction,
      amount: isNaN(parsedAmount) || parsedAmount <= 0 ? transaction.amount : parsedAmount,
      type: txType,
      merchant: merchant.trim() || null,
      description: description.trim() || null,
      transactionDate: date
        ? new Date(date + 'T00:00:00').toISOString()
        : transaction.transactionDate,
    });
  };

  // ── Read-only view (confirmed / cancelled) ──────────────────────────────────
  if (!isPending) {
    const prefix = transaction.type === 'expense' ? '−' : '+';
    const color = transaction.type === 'expense'
      ? 'text-red-600 dark:text-red-400'
      : 'text-green-600 dark:text-green-400';
    return (
      <View className="mb-4 mt-1">
        <View className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mx-2">
          <View className="flex-row items-center mb-3">
            <Text className="text-xl mr-2">{typeEmoji}</Text>
            <Text className="font-semibold text-gray-900 dark:text-white text-base flex-1">
              Transaction
            </Text>
            <View className={`px-2 py-0.5 rounded-full ${statusBadge}`}>
              <Text className="text-xs font-medium">{statusLabel}</Text>
            </View>
          </View>
          {[
            { label: 'Amount', value: `${prefix}${transaction.amount.toFixed(2)}`, cls: `font-semibold ${color}` },
            { label: 'Wallet', value: transaction.walletName },
            ...(transaction.merchant ? [{ label: 'Merchant', value: transaction.merchant, cls: undefined }] : []),
            ...(transaction.description ? [{ label: 'Note', value: transaction.description, cls: undefined }] : []),
            { label: 'Type', value: transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1) },
            { label: 'Date', value: new Date(transaction.transactionDate ?? Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) },
          ].map(({ label, value, cls }) => (
            <View key={label} className="flex-row justify-between mb-1.5">
              <Text className="text-gray-500 dark:text-gray-400 text-sm">{label}</Text>
              <Text className={`text-gray-900 dark:text-white text-sm text-right ml-4 ${cls ?? ''}`} style={{ maxWidth: '60%' }} numberOfLines={2}>{value}</Text>
            </View>
          ))}
          {status === 'confirmed' && (
            <View className="flex-row items-center justify-center pt-2">
              <Text className="text-green-600 dark:text-green-400 text-sm font-medium">
                Transaction saved successfully
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── Editable pending view ────────────────────────────────────────────────────
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

        {/* Type toggle */}
        <View className="flex-row mb-3 gap-2">
          {TX_TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTxType(t)}
              className={`flex-1 py-1.5 rounded-lg items-center border ${
                txType === t
                  ? t === 'expense'
                    ? 'bg-red-100 dark:bg-red-950 border-red-400 dark:border-red-600'
                    : t === 'income'
                    ? 'bg-green-100 dark:bg-green-950 border-green-400 dark:border-green-600'
                    : 'bg-blue-100 dark:bg-blue-950 border-blue-400 dark:border-blue-600'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600'
              }`}
              activeOpacity={0.7}
            >
              <Text
                className={`text-xs font-semibold capitalize ${
                  txType === t
                    ? t === 'expense'
                      ? 'text-red-600 dark:text-red-400'
                      : t === 'income'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Editable rows */}
        <View className="mb-3">
          {/* Amount */}
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-gray-500 dark:text-gray-400 text-sm w-20">Amount</Text>
            <TextInput
              className="flex-1 text-right text-sm font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5"
              style={{ color: amountColor }}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
          </View>

          {/* Wallet — read-only */}
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-gray-500 dark:text-gray-400 text-sm w-20">Wallet</Text>
            <Text className="text-gray-900 dark:text-white text-sm text-right flex-1" numberOfLines={1}>
              {transaction.walletName}
            </Text>
          </View>

          {/* Merchant */}
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-gray-500 dark:text-gray-400 text-sm w-20">Merchant</Text>
            <TextInput
              className="flex-1 text-right text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5"
              value={merchant}
              onChangeText={setMerchant}
              placeholder="optional"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Note */}
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-gray-500 dark:text-gray-400 text-sm w-20">Note</Text>
            <TextInput
              className="flex-1 text-right text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5"
              value={description}
              onChangeText={setDescription}
              placeholder="optional"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Date */}
          <View className="flex-row items-center justify-between">
            <Text className="text-gray-500 dark:text-gray-400 text-sm w-20">Date</Text>
            <TextInput
              className="flex-1 text-right text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {/* Action buttons */}
        <View className="flex-row">
          <TouchableOpacity
            className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl py-3 items-center mr-2"
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <Text className="text-gray-700 dark:text-gray-300 font-medium text-sm">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-blue-600 rounded-xl py-3 items-center"
            onPress={handleConfirm}
            activeOpacity={0.7}
          >
            <Text className="text-white font-semibold text-sm">Confirm & Save</Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
}

function EmptyState() {
  const suggestions = [
    'Log RM45 food expense on TNG',
    'Show my recent transactions',
    'What are my wallet balances?',
    'Add RM2500 salary income',
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
        Your on-device finance assistant. Log transactions, review spending, and check your balances — all privately on your device.
      </Text>
      <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
        Try asking
      </Text>
      <View className="w-full">
        {suggestions.map((s) => (
          <View key={s} className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 mb-2">
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
              { label: 'Model', value: 'Qwen 3.5 2B Instruct (Q4)' },
              { label: 'Size', value: '~1.5 GB' },
              { label: 'Privacy', value: 'Runs entirely on your device' },
              { label: 'Requires', value: 'One-time download' },
            ].map(({ label, value }) => (
              <View
                key={label}
                className="flex-row justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
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
