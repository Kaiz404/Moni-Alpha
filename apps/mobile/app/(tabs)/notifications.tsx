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
          <Text className="text-white text-xs font-semibold">Download (≈500 MB)</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (pendingCount > 0 && !isProcessing) {
    return (
      <TouchableOpacity
        className="mx-4 mb-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 flex-row items-center justify-between"
        onPress={onProcess}>
        <Text className="text-xs text-indigo-700 dark:text-indigo-300">
          {pendingCount} notification{pendingCount !== 1 ? 's' : ''} waiting for analysis
        </Text>
        <Text className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
          Analyse now →
        </Text>
      </TouchableOpacity>
    );
  }

  if (isProcessing) {
    return (
      <View className="mx-4 mb-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 flex-row items-center gap-3">
        <ActivityIndicator size="small" color="#6366f1" />
        <Text className="text-xs text-indigo-700 dark:text-indigo-300">
          Analysing notifications with AI…
        </Text>
      </View>
    );
  }

  return null;
}

// ─── Raw notification card ────────────────────────────────────────────────────

function NotificationCard({
  item,
  onDismiss,
}: {
  item: CapturedNotification;
  onDismiss: (id: string) => void;
}) {
  const displayTitle = item.titleBig || item.title || '(no title)';
  const displayBody = item.bigText || item.text || item.subText || item.summaryText || '(no content)';
  const received = new Date(item.receivedAt);

  return (
    <View className="mx-4 mb-3 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center flex-1 mr-2">
          <View className="w-2 h-2 rounded-full bg-blue-400 mr-2" />
          <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex-1" numberOfLines={1}>
            {item.app || 'Unknown app'}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-gray-400 dark:text-gray-500">
            {received.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <TouchableOpacity
            onPress={() => onDismiss(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <IconSymbol name="xmark" size={12} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      </View>
      <Text className="text-sm font-semibold text-gray-900 dark:text-white mb-1" numberOfLines={2}>
        {displayTitle}
      </Text>
      <Text className="text-sm text-gray-600 dark:text-gray-400" numberOfLines={3}>
        {displayBody}
      </Text>
    </View>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between px-4 py-2 mb-1">
      <View className="flex-row items-center gap-2">
        <Text className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {title}
        </Text>
        {count != null && count > 0 && (
          <View className="px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700">
            <Text className="text-xs font-semibold text-gray-600 dark:text-gray-300">{count}</Text>
          </View>
        )}
      </View>
      {action}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const {
    permissionStatus,
    isCheckingPermission,
    notifications,
    requestPermission,
    refresh: refreshNotifications,
    clearAll,
    clearOne,
  } = useNotificationListener();

  const {
    isProcessing,
    pendingCount,
    modelStatus,
    downloadProgress,
    processQueue,
    downloadModel,
    refreshPendingCount,
  } = useNotificationProcessor();

  const {
    proposals,
    isLoading: proposalsLoading,
    approve,
    reject,
    reload: reloadProposals,
    fetchWallets,
  } = useProposedTransactions();

  const [refreshing, setRefreshing] = useState(false);
  const [walletPickerVisible, setWalletPickerVisible] = useState(false);
  const [walletPickerWallets, setWalletPickerWallets] = useState<WalletItem[]>([]);
  const [pendingApproval, setPendingApproval] = useState<ProposedTransaction | null>(null);
  const [showRawNotifications, setShowRawNotifications] = useState(false);

  const isAuthorized = permissionStatus === 'authorized';

  // Refresh everything when tab gains focus
  useFocusEffect(
    useCallback(() => {
      refreshNotifications();
      refreshPendingCount();
      reloadProposals();
    }, [refreshNotifications, refreshPendingCount, reloadProposals]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      reloadProposals(),
      refreshNotifications(),
      refreshPendingCount(),
    ]);
    setRefreshing(false);
  }, [reloadProposals, refreshNotifications, refreshPendingCount]);

  // Approve flow — show wallet picker if walletId is unknown
  const handleApprove = useCallback(
    async (proposal: ProposedTransaction) => {
      if (proposal.walletId) {
        try {
          await approve(proposal, proposal.walletId);
          Alert.alert('Approved', 'Transaction has been added to your records.');
        } catch (e) {
          Alert.alert('Error', e instanceof Error ? e.message : 'Failed to approve');
        }
        return;
      }

      // Need to pick a wallet
      setPendingApproval(proposal);
      const wallets = await fetchWallets();
      setWalletPickerWallets(
        wallets.map((w) => ({ id: w.id, name: w.name ?? '', currency: w.currency ?? 'USD' })),
      );
      setWalletPickerVisible(true);
    },
    [approve, fetchWallets],
  );

  const handleWalletSelected = useCallback(
    async (walletId: string) => {
      setWalletPickerVisible(false);
      if (!pendingApproval) return;
      try {
        await approve(pendingApproval, walletId);
        Alert.alert('Approved', 'Transaction has been added to your records.');
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to approve');
      }
      setPendingApproval(null);
    },
    [approve, pendingApproval],
  );

  const handleReject = useCallback(
    (id: string) => {
      Alert.alert('Reject proposal', 'This will discard the AI-proposed transaction.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => reject(id),
        },
      ]);
    },
    [reject],
  );

  const handleClearAll = useCallback(() => {
    Alert.alert('Clear all notifications', 'Remove all raw notifications from the list?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: clearAll },
    ]);
  }, [clearAll]);

  const isUnavailable = permissionStatus === 'unavailable' || Platform.OS !== 'android';

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      {/* Permission banner */}
      {!isAuthorized && !isUnavailable && (
        <View className="mx-4 mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
          <Text className="text-blue-800 dark:text-blue-300 font-semibold text-sm mb-1">
            Notification access required
          </Text>
          <Text className="text-blue-700 dark:text-blue-400 text-sm mb-3">
            Allow Moni to read notifications from banking and wallet apps so the
            AI can detect and propose transaction records automatically.
          </Text>
          <TouchableOpacity
            className="bg-blue-600 dark:bg-blue-500 px-4 py-2.5 rounded-lg self-start"
            onPress={requestPermission}
            disabled={isCheckingPermission}>
            <Text className="text-white font-semibold text-sm">
              {isCheckingPermission ? 'Checking…' : 'Enable in Settings'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isUnavailable && (
        <View className="mx-4 mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
          <Text className="text-amber-800 dark:text-amber-300 font-semibold text-sm">
            Android only
          </Text>
          <Text className="text-amber-700 dark:text-amber-400 text-sm mt-1">
            Notification listening is only available on Android.
          </Text>
        </View>
      )}

      <FlatList
        data={[]}
        renderItem={null}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListHeaderComponent={
          <View className="pt-3 pb-2">
            {/* AI processor status */}
            <ProcessorBar
              modelStatus={modelStatus}
              downloadProgress={downloadProgress}
              isProcessing={isProcessing}
              pendingCount={pendingCount}
              onProcess={processQueue}
              onDownload={downloadModel}
            />

            {/* ── Proposed transactions ── */}
            <SectionHeader
              title="Proposed Transactions"
              count={proposals.length}
              action={
                proposalsLoading ? (
                  <ActivityIndicator size="small" color="#6b7280" />
                ) : undefined
              }
            />

            {proposals.length === 0 && !proposalsLoading && (
              <View className="mx-4 mb-4 p-4 rounded-xl bg-white dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700 items-center">
                <IconSymbol name="sparkles" size={24} color="#9ca3af" />
                <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2">
                  No pending proposals.{'\n'}
                  {isAuthorized
                    ? 'When financial notifications arrive, the AI will analyse them and propose transactions here.'
                    : 'Enable notification access above to get started.'}
                </Text>
              </View>
            )}

            {proposals.map((p) => (
              <ProposalCard
                key={p.id}
                item={p}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}

            {/* ── Raw notifications toggle ── */}
            <TouchableOpacity
              className="mx-4 mt-2 mb-1 flex-row items-center justify-between"
              onPress={() => setShowRawNotifications((v) => !v)}>
              <SectionHeader
                title="Raw Notifications"
                count={notifications.length}
                action={
                  <IconSymbol
                    name={showRawNotifications ? 'chevron.up' : 'chevron.down'}
                    size={14}
                    color="#9ca3af"
                  />
                }
              />
            </TouchableOpacity>

            {showRawNotifications && notifications.length === 0 && (
              <View className="mx-4 mb-3 items-center py-6">
                <Text className="text-sm text-gray-400 dark:text-gray-500">
                  No notifications captured yet.
                </Text>
              </View>
            )}

            {showRawNotifications &&
              notifications.length > 0 && (
                <View className="flex-row justify-end px-4 mb-2">
                  <TouchableOpacity onPress={handleClearAll}>
                    <Text className="text-xs text-red-500 dark:text-red-400 font-medium">
                      Clear all
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

            {showRawNotifications &&
              notifications.map((n) => (
                <NotificationCard key={n.id} item={n} onDismiss={clearOne} />
              ))}
          </View>
        }
        keyExtractor={() => 'header'}
        showsVerticalScrollIndicator={false}
      />

      {/* Wallet picker modal */}
      <WalletPickerModal
        visible={walletPickerVisible}
        wallets={walletPickerWallets}
        onSelect={handleWalletSelected}
        onCancel={() => {
          setWalletPickerVisible(false);
          setPendingApproval(null);
        }}
      />
    </View>
  );
}
