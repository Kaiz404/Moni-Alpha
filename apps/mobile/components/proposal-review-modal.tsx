import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Pressable,
  AppState,
  DeviceEventEmitter,
  StyleSheet,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Image } from 'expo-image';
import type { ProposedTransaction } from '@repo/types';
import {
  getProposedTransactions,
  approveProposedTransaction,
  rejectProposedTransaction,
} from '@/lib/supabase/proposed-transactions';
import { PROPOSED_TRANSACTIONS_CHANGED } from '@/lib/proposals/proposed-transactions-events';
import { getProposalLocationSnapshot } from '@/lib/ai/proposal-location-cache';
import { getWallets } from '@/lib/supabase/wallets';

type WalletOption = {
  id: string;
  name: string;
  type: string;
  currency: string;
};

const TX_TYPES = ['expense', 'income'] as const;

export function ProposalReviewModal() {
  const [proposals, setProposals] = useState<ProposedTransaction[]>([]);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const proposalsRef = useRef(proposals);
  proposalsRef.current = proposals;
  const appStateRef = useRef(AppState.currentState);

  const visible = proposals.length > 0 && !isLoading;
  const current = proposals[currentIndex];

  const loadData = useCallback(async () => {
    const quietRefresh = proposalsRef.current.length > 0;
    if (!quietRefresh) setIsLoading(true);
    try {
      const [pending, ws] = await Promise.all([
        getProposedTransactions('pending'),
        getWallets(),
      ]);
      setProposals(pending);
      setWallets(
        ws.map((w) => ({
          id: w.id,
          name: w.name ?? 'Wallet',
          type: w.type ?? 'other',
          currency: w.currency ?? 'MYR',
        })),
      );
      setCurrentIndex(0);
    } catch (e) {
      console.warn('[ProposalReview] load error:', e);
    } finally {
      if (!quietRefresh) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(PROPOSED_TRANSACTIONS_CHANGED, () => {
      loadData();
    });
    return () => sub.remove();
  }, [loadData]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        loadData();
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [loadData]);

  const handleApprove = useCallback(
    async (edited: EditedFields) => {
      if (!current || isActioning) return;
      setIsActioning(true);
      try {
        const walletId = edited.walletId ?? current.walletId;
        if (!walletId) {
          // Cannot approve without a wallet
          return;
        }

        const updatedProposal: ProposedTransaction = {
          ...current,
          amount: edited.amount,
          type: edited.type,
          merchant: edited.merchant || null,
          description: edited.description || null,
          transactionDate: edited.date
            ? new Date(edited.date + 'T00:00:00').toISOString()
            : current.transactionDate,
        };

        await approveProposedTransaction(updatedProposal, walletId);
        advanceOrDismiss();
      } catch (e) {
        console.error('[ProposalReview] approve error:', e);
      } finally {
        setIsActioning(false);
      }
    },
    [current, isActioning, proposals, currentIndex],
  );

  const handleReject = useCallback(async () => {
    if (!current || isActioning) return;
    setIsActioning(true);
    try {
      await rejectProposedTransaction(current.id);
      advanceOrDismiss();
    } catch (e) {
      console.error('[ProposalReview] reject error:', e);
    } finally {
      setIsActioning(false);
    }
  }, [current, isActioning, proposals, currentIndex]);

  function advanceOrDismiss() {
    const remaining = proposals.filter((_, i) => i !== currentIndex);
    setProposals(remaining);
    if (remaining.length === 0) {
      setCurrentIndex(0);
    } else {
      setCurrentIndex(Math.min(currentIndex, remaining.length - 1));
    }
  }

  if (!visible || !current) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <View className="flex-1 bg-white dark:bg-gray-900">
        {/* Header */}
        <View className="pt-14 pb-4 px-6 border-b border-gray-200 dark:border-gray-700">
          <Text className="text-xl font-bold text-gray-900 dark:text-white">
            Review Transaction Proposal
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {proposals.length > 1
              ? `${currentIndex + 1} of ${proposals.length} proposals`
              : 'AI detected a transaction for your review'}
          </Text>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
          <ProposalForm
            proposal={current}
            wallets={wallets}
            isActioning={isActioning}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Proposal form ───────────────────────────────────────────────────────────

type EditedFields = {
  amount: number;
  type: 'income' | 'expense';
  walletId: string | null;
  merchant: string;
  description: string;
  date: string;
};

function ProposalForm({
  proposal,
  wallets,
  isActioning,
  onApprove,
  onReject,
}: {
  proposal: ProposedTransaction;
  wallets: WalletOption[];
  isActioning: boolean;
  onApprove: (edited: EditedFields) => void;
  onReject: () => void;
}) {
  const [txType, setTxType] = useState<'income' | 'expense'>(
    (proposal.type as 'income' | 'expense') ?? 'expense',
  );
  const [amount, setAmount] = useState(proposal.amount?.toFixed(2) ?? '0.00');
  const [merchant, setMerchant] = useState(proposal.merchant ?? '');
  const [description, setDescription] = useState(proposal.description ?? '');
  const [date, setDate] = useState(
    proposal.transactionDate
      ? new Date(proposal.transactionDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
  );
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(
    proposal.walletId,
  );
  const [showWalletPicker, setShowWalletPicker] = useState(false);

  // Reset form when proposal changes
  useEffect(() => {
    setTxType((proposal.type as 'income' | 'expense') ?? 'expense');
    setAmount(proposal.amount?.toFixed(2) ?? '0.00');
    setMerchant(proposal.merchant ?? '');
    setDescription(proposal.description ?? '');
    setDate(
      proposal.transactionDate
        ? new Date(proposal.transactionDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
    );
    setSelectedWalletId(proposal.walletId);
  }, [proposal.id]);

  const selectedWallet = wallets.find((w) => w.id === selectedWalletId);
  const amountColor = txType === 'expense' ? '#DC2626' : '#16A34A';
  const sourceLabel = {
    text: '💬 From text input',
    image: '📷 From receipt photo',
    notification: `🔔 From ${proposal.sourceApp ?? 'notification'}`,
  }[proposal.sourceType ?? 'notification'];

  const handleApprove = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    if (!selectedWalletId) {
      setShowWalletPicker(true);
      return;
    }
    onApprove({
      amount: parsedAmount,
      type: txType,
      walletId: selectedWalletId,
      merchant,
      description,
      date,
    });
  };

  return (
    <View>
      {/* Source badge */}
      <View className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 mb-4">
        <Text className="text-sm text-gray-600 dark:text-gray-400">{sourceLabel}</Text>
        {proposal.sourceText && (
          <Text className="text-gray-900 dark:text-white text-sm mt-1" numberOfLines={3}>
            &ldquo;{proposal.sourceText}&rdquo;
          </Text>
        )}
        {proposal.sourceImageUri && (
          <Image
            source={{ uri: proposal.sourceImageUri }}
            style={{ width: '100%', height: 160, borderRadius: 8, marginTop: 8 }}
            contentFit="cover"
          />
        )}
        {proposal.sourceType === 'notification' && proposal.notificationBody && (
          <Text className="text-gray-900 dark:text-white text-sm mt-1" numberOfLines={3}>
            {proposal.notificationTitle}: {proposal.notificationBody}
          </Text>
        )}
      </View>

      <ProposalLocationSection proposalId={proposal.id} />

      {/* Type toggle */}
      <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
        Transaction Type
      </Text>
      <View className="flex-row mb-4 gap-2">
        {TX_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTxType(t)}
            className={`flex-1 py-2.5 rounded-xl items-center border ${
              txType === t
                ? t === 'expense'
                  ? 'bg-red-50 dark:bg-red-950 border-red-400'
                  : 'bg-green-50 dark:bg-green-950 border-green-400'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600'
            }`}
            activeOpacity={0.7}
          >
            <Text
              className={`text-sm font-semibold capitalize ${
                txType === t
                  ? t === 'expense'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-600 dark:text-green-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Amount */}
      <FieldRow label="Amount">
        <TextInput
          className="flex-1 text-right text-base font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2"
          style={{ color: amountColor }}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />
      </FieldRow>

      {/* Wallet */}
      <FieldRow label="Wallet">
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-end bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2"
          onPress={() => setShowWalletPicker(!showWalletPicker)}
          activeOpacity={0.7}
        >
          <Text
            className={`text-sm ${
              selectedWallet
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {selectedWallet?.name ?? 'Select wallet...'}
          </Text>
          <Text className="text-gray-400 ml-2 text-xs">▼</Text>
        </TouchableOpacity>
      </FieldRow>

      {/* Wallet picker dropdown */}
      {showWalletPicker && (
        <View className="mb-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
          {wallets.map((w) => (
            <Pressable
              key={w.id}
              className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 ${
                w.id === selectedWalletId ? 'bg-blue-50 dark:bg-blue-950' : ''
              }`}
              onPress={() => {
                setSelectedWalletId(w.id);
                setShowWalletPicker(false);
              }}
            >
              <Text className="text-gray-900 dark:text-white text-sm font-medium">
                {w.name}
              </Text>
              <Text className="text-gray-400 dark:text-gray-500 text-xs capitalize">
                {w.type} · {w.currency}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Merchant */}
      <FieldRow label="Merchant">
        <TextInput
          className="flex-1 text-right text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2"
          value={merchant}
          onChangeText={setMerchant}
          placeholder="optional"
          placeholderTextColor="#9CA3AF"
        />
      </FieldRow>

      {/* Description */}
      <FieldRow label="Description">
        <TextInput
          className="flex-1 text-right text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2"
          value={description}
          onChangeText={setDescription}
          placeholder="optional"
          placeholderTextColor="#9CA3AF"
        />
      </FieldRow>

      {/* Date */}
      <FieldRow label="Date">
        <TextInput
          className="flex-1 text-right text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2"
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#9CA3AF"
        />
      </FieldRow>

      {/* AI reasoning (collapsible) */}
      {proposal.aiReasoning && (
        <AIReasoningSection
          reasoning={proposal.aiReasoning}
          confidence={proposal.aiConfidence}
        />
      )}

      {/* Action buttons */}
      <View className="flex-row mt-6 gap-3">
        <TouchableOpacity
          className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl py-4 items-center"
          onPress={onReject}
          disabled={isActioning}
          activeOpacity={0.7}
        >
          {isActioning ? (
            <ActivityIndicator size="small" color="#6B7280" />
          ) : (
            <Text className="text-gray-700 dark:text-gray-300 font-semibold text-base">
              Decline
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 rounded-xl py-4 items-center ${
            selectedWalletId ? 'bg-blue-600' : 'bg-blue-400'
          }`}
          onPress={handleApprove}
          disabled={isActioning}
          activeOpacity={0.7}
        >
          {isActioning ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white font-semibold text-base">
              {selectedWalletId ? 'Approve' : 'Select Wallet'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Utility components ──────────────────────────────────────────────────────

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center mb-3">
      <Text className="text-gray-500 dark:text-gray-400 text-sm w-24">{label}</Text>
      {children}
    </View>
  );
}

/** Optional collapsible map when a location was captured with this proposal (MMKV cache). */
function ProposalLocationSection({ proposalId }: { proposalId: string }) {
  const [expanded, setExpanded] = useState(false);
  const snapshot = useMemo(() => getProposalLocationSnapshot(proposalId), [proposalId]);

  const region = useMemo(() => {
    if (!snapshot) return null;
    return {
      latitude: snapshot.latitude,
      longitude: snapshot.longitude,
      latitudeDelta: 0.006,
      longitudeDelta: 0.006,
    };
  }, [snapshot]);

  if (!snapshot || !region) return null;

  return (
    <View className="mb-4">
      <TouchableOpacity
        className="flex-row items-center"
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Captured location {expanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>
      {expanded ? (
        <View className="mt-2">
          <View
            className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-800"
            style={styles.locationMapBox}
          >
            <MapView
              style={styles.locationMap}
              initialRegion={region}
              provider="google"
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
            >
              <Marker
                coordinate={{
                  latitude: snapshot.latitude,
                  longitude: snapshot.longitude,
                }}
                pinColor="#1e88e5"
              />
            </MapView>
          </View>
          {snapshot.name ? (
            <Text
              className="text-gray-500 dark:text-gray-400 text-xs mt-2"
              numberOfLines={3}
            >
              {snapshot.name}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  locationMapBox: {
    height: 200,
    width: '100%',
  },
  locationMap: {
    ...StyleSheet.absoluteFillObject,
  },
});

function AIReasoningSection({
  reasoning,
  confidence,
}: {
  reasoning: string;
  confidence: number | null;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="mt-4">
      <TouchableOpacity
        className="flex-row items-center"
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text className="text-gray-400 dark:text-gray-500 text-xs font-medium">
          AI Analysis {expanded ? '▲' : '▼'}
        </Text>
        {confidence !== null && (
          <View className="ml-2 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
            <Text className="text-gray-500 dark:text-gray-400 text-xs">
              {Math.round(confidence * 100)}% confidence
            </Text>
          </View>
        )}
      </TouchableOpacity>
      {expanded && (
        <Text className="text-gray-400 dark:text-gray-500 text-xs mt-2 leading-4">
          {reasoning}
        </Text>
      )}
    </View>
  );
}
