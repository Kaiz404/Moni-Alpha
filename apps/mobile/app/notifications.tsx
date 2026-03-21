import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useNotificationListener } from '@/hooks/use-notification-listener';
import { useNotificationProcessor } from '@/hooks/use-notification-processor';
import { useProposedTransactions } from '@/hooks/use-proposed-transactions';
import type { CapturedNotification } from '@/hooks/use-notification-listener';
import type { ProposedTransaction } from '@repo/types';

// ─── Wallet picker modal ──────────────────────────────────────────────────────

type WalletItem = { id: string; name: string; currency: string };

function WalletPickerModal({
  visible,
  wallets,
  onSelect,
  onCancel,
}: {
  visible: boolean;
  wallets: WalletItem[];
  onSelect: (walletId: string) => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white dark:bg-gray-900 rounded-t-2xl p-6 pb-10">
          <Text className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Select wallet for this transaction
          </Text>
          {wallets.map((w) => (
            <TouchableOpacity
              key={w.id}
              className="flex-row items-center py-3 border-b border-gray-100 dark:border-gray-800"
              onPress={() => onSelect(w.id)}>
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-900 dark:text-white">
                  {w.name}
                </Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">{w.currency}</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color="#9ca3af" />
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            className="mt-4 py-3 items-center rounded-lg bg-gray-100 dark:bg-gray-800"
            onPress={onCancel}>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Proposed transaction card ────────────────────────────────────────────────

function ProposalCard({
  item,
  onApprove,
  onReject,
}: {
  item: ProposedTransaction;
  onApprove: (p: ProposedTransaction) => void;
  onReject: (id: string) => void;
}) {
  const isExpense = item.type === 'expense' || !item.type;
  const confidencePct = item.aiConfidence != null
    ? Math.round(item.aiConfidence * 100)
    : null;

  return (
    <View className="mx-4 mb-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
      {/* Coloured top stripe */}
      <View className={`h-1 ${isExpense ? 'bg-red-400' : 'bg-green-400'}`} />

      <View className="p-4">
        {/* Source & confidence */}
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-1.5">
            <View className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950">
              <Text className="text-xs font-medium text-blue-600 dark:text-blue-400">
                {item.sourceApp || 'Unknown app'}
              </Text>
            </View>
            {item.notificationReceivedAt && (
              <Text className="text-xs text-gray-400 dark:text-gray-500">
                {new Date(item.notificationReceivedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            )}
          </View>
          {confidencePct != null && (
            <Text className="text-xs text-gray-400 dark:text-gray-500">
              {confidencePct}% confidence
            </Text>
          )}
        </View>

        {/* Amount + type */}
        <View className="flex-row items-baseline gap-2 mb-1">
          <Text
            className={`text-2xl font-bold ${isExpense ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {isExpense ? '−' : '+'}
            {item.currency ?? ''} {item.amount?.toFixed(2) ?? '—'}
          </Text>
          <Text className="text-xs uppercase font-semibold text-gray-400 dark:text-gray-500">
            {item.type ?? 'unknown'}
          </Text>
        </View>

        {/* Merchant / description */}
        {(item.merchant || item.description) && (
          <Text
            className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1"
            numberOfLines={1}>
            {item.merchant || item.description}
          </Text>
        )}

        {/* Hints */}
        <View className="flex-row flex-wrap gap-1.5 mb-2">
          {item.walletHint && (
            <View className="px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950">
              <Text className="text-xs text-purple-600 dark:text-purple-400">
                {item.walletHint}
              </Text>
            </View>
          )}
          {item.categoryHint && (
            <View className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950">
              <Text className="text-xs text-amber-700 dark:text-amber-400">
                {item.categoryHint}
              </Text>
            </View>
          )}
        </View>

        {/* AI reasoning */}
        {item.aiReasoning && (
          <Text className="text-xs text-gray-500 dark:text-gray-400 italic mb-3" numberOfLines={2}>
            "{item.aiReasoning}"
          </Text>
        )}

        {/* Actions */}
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-lg bg-green-600 dark:bg-green-700"
            onPress={() => onApprove(item)}>
            <IconSymbol name="checkmark" size={14} color="white" />
            <Text className="text-white text-sm font-semibold">Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700"
            onPress={() => onReject(item.id)}>
            <IconSymbol name="xmark" size={14} color="#6b7280" />
            <Text className="text-gray-700 dark:text-gray-300 text-sm font-semibold">Reject</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Processor status bar ─────────────────────────────────────────────────────

function ProcessorBar({
  modelStatus,
  downloadProgress,
  isProcessing,
  pendingCount,
  onProcess,
  onDownload,
}: {
  modelStatus: string;
  downloadProgress: number;
  isProcessing: boolean;
  pendingCount: number;
  onProcess: () => void;
  onDownload: () => void;
}) {
  if (modelStatus === 'downloading') {
    return (
      <View className="mx-4 mb-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 flex-row items-center gap-3">
        <ActivityIndicator size="small" color="#3b82f6" />
        <Text className="text-xs text-blue-700 dark:text-blue-300 flex-1">
          Downloading Qwen3.5-0.8B… {downloadProgress}%
        </Text>
      </View>
    );
  }

  if (modelStatus === 'not-downloaded') {
    return (
      <View className="mx-4 mb-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
        <Text className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
          AI model not downloaded
        </Text>
        <Text className="text-xs text-amber-700 dark:text-amber-400 mb-2">
          Download Qwen3.5-0.8B to analyse notifications automatically.
          While not available, the chat model will be used as a fallback.
        </Text>
        <TouchableOpacity
          className="bg-amber-600 px-3 py-1.5 rounded-lg self-start"
          onPress={onDownload}>
          <Text className="text-white text-sm font-semibold">Download model</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

export default function NotificationsScreen() {
  const { notifications, clearNotifications } = useNotificationListener();
  const { processNotification, status, downloadProgress } = useNotificationProcessor();
  const { proposed, approve, reject } = useProposedTransactions();

  useFocusEffect(
    useCallback(() => {
      // noop for now
    }, [])
  );

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <Text className="text-xl font-semibold p-4 text-gray-900 dark:text-white">Notifications</Text>
      <FlatList
        data={notifications}
        keyExtractor={(n: CapturedNotification) => n.id}
        renderItem={({ item }) => (
          <View className="p-4 border-b border-gray-100 dark:border-gray-800">
            <Text className="text-sm text-gray-800 dark:text-gray-200">{item.title}</Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400">{item.body}</Text>
          </View>
        )}
        ListEmptyComponent={<Text className="p-4 text-gray-500">No notifications</Text>}
      />
    </View>
  );
}
