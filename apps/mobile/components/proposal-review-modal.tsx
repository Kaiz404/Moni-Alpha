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
  Alert,
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
import { getDefaultWalletId } from '@/lib/wallets/default-wallet';
import {
  displayCurrencyForProposal,
  resolveInitialWalletId,
} from '@/lib/wallets/proposal-wallet';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

type WalletOption = {
  id: string;
  name: string;
  type: string;
  currency: string;
};

const TX_TYPES = ['expense', 'income', 'transfer'] as const;
type TxType = (typeof TX_TYPES)[number];

function normalizeTxType(type: ProposedTransaction['type']): TxType {
  if (type === 'income' || type === 'expense' || type === 'transfer') return type;
  return 'expense';
}

export function ProposalReviewModal() {
  const tokens = useThemeTokens();
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
      const [pending, ws] = await Promise.all([getProposedTransactions(), getWallets()]);
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

  function advanceOrDismiss() {
    const remaining = proposals.filter((_, i) => i !== currentIndex);
    setProposals(remaining);
    if (remaining.length === 0) {
      setCurrentIndex(0);
    } else {
      setCurrentIndex(Math.min(currentIndex, remaining.length - 1));
    }
  }

  const handleApprove = useCallback(
    async (edited: EditedFields) => {
      if (!current || isActioning) return;
      setIsActioning(true);
      try {
        const effectiveType = edited.type ?? current.type ?? 'expense';
        const walletId = edited.walletId ?? current.walletId;
        const transferToWalletId = edited.transferToWalletId ?? current.transferToWalletId;

        if (!walletId) {
          Alert.alert('Cannot approve', 'Select a source wallet.');
          return;
        }

        if (effectiveType === 'transfer') {
          if (!transferToWalletId) {
            Alert.alert('Cannot approve', 'Select a destination wallet for this transfer.');
            return;
          }
          if (walletId === transferToWalletId) {
            Alert.alert('Cannot approve', 'Source and destination wallets must differ.');
            return;
          }
          const fromWallet = wallets.find((w) => w.id === walletId);
          const toWallet = wallets.find((w) => w.id === transferToWalletId);
          if (fromWallet && toWallet) {
            const fromCur = fromWallet.currency.toUpperCase();
            const toCur = toWallet.currency.toUpperCase();
            if (fromCur !== toCur) {
              Alert.alert(
                'Cannot approve',
                'Transfers require both wallets to use the same currency.',
              );
              return;
            }
          }
        }

        const updatedProposal: ProposedTransaction = {
          ...current,
          amount: edited.amount,
          type: effectiveType,
          merchant: effectiveType === 'transfer' ? null : edited.merchant || null,
          description: edited.description || null,
          transactionDate: edited.date
            ? new Date(edited.date + 'T00:00:00').toISOString()
            : current.transactionDate,
        };

        await approveProposedTransaction(updatedProposal, {
          walletId,
          transferToWalletId: effectiveType === 'transfer' ? transferToWalletId : null,
        });
        advanceOrDismiss();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to approve';
        console.error('[ProposalReview] approve error:', e);
        Alert.alert('Error', message);
      } finally {
        setIsActioning(false);
      }
    },
    [current, isActioning, wallets, proposals, currentIndex],
  );

  const handleReject = useCallback(async () => {
    if (!current || isActioning) return;
    setIsActioning(true);
    try {
      await rejectProposedTransaction(current.id);
      advanceOrDismiss();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to reject';
      console.error('[ProposalReview] reject error:', e);
      Alert.alert('Error', message);
    } finally {
      setIsActioning(false);
    }
  }, [current, isActioning, proposals, currentIndex]);

  if (!visible || !current) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <View className="flex-1 bg-background">
        <View className="border-b border-border px-6 pb-4 pt-14">
          <Text className="text-xl font-bold text-foreground">
            Review Transaction Proposal
          </Text>
          <Text className="mt-1 text-sm text-muted">
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

type EditedFields = {
  amount: number;
  type: TxType;
  walletId: string | null;
  transferToWalletId: string | null;
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
  const tokens = useThemeTokens();
  const [txType, setTxType] = useState<TxType>(normalizeTxType(proposal.type));
  const [amount, setAmount] = useState(proposal.amount?.toFixed(2) ?? '0.00');
  const [merchant, setMerchant] = useState(proposal.merchant ?? '');
  const [description, setDescription] = useState(proposal.description ?? '');
  const [date, setDate] = useState(
    proposal.transactionDate
      ? new Date(proposal.transactionDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
  );
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(() =>
    resolveInitialWalletId(proposal, wallets, getDefaultWalletId()),
  );
  const [selectedTransferToWalletId, setSelectedTransferToWalletId] = useState<string | null>(
    proposal.transferToWalletId,
  );
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [showTransferToPicker, setShowTransferToPicker] = useState(false);

  const isTransfer = txType === 'transfer';
  const destinationWallets = useMemo(
    () => wallets.filter((w) => w.id !== selectedWalletId),
    [wallets, selectedWalletId],
  );

  useEffect(() => {
    setTxType(normalizeTxType(proposal.type));
    setAmount(proposal.amount?.toFixed(2) ?? '0.00');
    setMerchant(proposal.merchant ?? '');
    setDescription(proposal.description ?? '');
    setDate(
      proposal.transactionDate
        ? new Date(proposal.transactionDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
    );
    setSelectedWalletId(resolveInitialWalletId(proposal, wallets, getDefaultWalletId()));
    setSelectedTransferToWalletId(proposal.transferToWalletId);
    setShowWalletPicker(false);
    setShowTransferToPicker(false);
  }, [proposal, wallets]);

  useEffect(() => {
    if (!isTransfer) return;
    if (selectedTransferToWalletId && selectedTransferToWalletId === selectedWalletId) {
      setSelectedTransferToWalletId(null);
    }
  }, [isTransfer, selectedWalletId, selectedTransferToWalletId]);

  const selectedWallet = wallets.find((w) => w.id === selectedWalletId);
  const selectedTransferToWallet = wallets.find((w) => w.id === selectedTransferToWalletId);
  const displayCurrency = displayCurrencyForProposal(
    { walletId: selectedWalletId, currency: proposal.currency },
    wallets,
    getDefaultWalletId(),
  );
  const amountColor = isTransfer ? tokens.transfer : txType === 'expense' ? tokens.expense : tokens.income;
  const sourceLabel = {
    text: '💬 From text input',
    image: '📷 From receipt photo',
    notification: `🔔 From ${proposal.sourceApp ?? 'notification'}`,
  }[proposal.sourceType ?? 'notification'];

  const canApprove =
    !!selectedWalletId && (!isTransfer || !!selectedTransferToWalletId);

  const handleApprovePress = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Cannot approve', 'Enter a valid positive amount.');
      return;
    }
    if (!selectedWalletId) {
      setShowWalletPicker(true);
      Alert.alert('Select wallet', isTransfer ? 'Choose the source wallet.' : 'Choose a wallet.');
      return;
    }
    if (isTransfer && !selectedTransferToWalletId) {
      setShowTransferToPicker(true);
      Alert.alert('Select wallet', 'Choose the destination wallet for this transfer.');
      return;
    }
    onApprove({
      amount: parsedAmount,
      type: txType,
      walletId: selectedWalletId,
      transferToWalletId: isTransfer ? selectedTransferToWalletId : null,
      merchant,
      description,
      date,
    });
  };

  return (
    <View>
      <View className="mb-4 rounded-xl bg-background-muted px-4 py-3">
        <Text className="text-sm text-muted">{sourceLabel}</Text>
        {proposal.sourceText && (
          <Text className="mt-1 text-sm text-foreground" numberOfLines={3}>
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
          <Text className="mt-1 text-sm text-foreground" numberOfLines={3}>
            {proposal.notificationTitle}: {proposal.notificationBody}
          </Text>
        )}
      </View>

      <ProposalLocationSection proposalId={proposal.id} />

      <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
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
                  : t === 'income'
                    ? 'bg-green-50 dark:bg-green-950 border-green-400'
                    : 'bg-primary-muted border-sky-400'
                : 'bg-card border-border'
            }`}
            activeOpacity={0.7}
          >
            <Text
              className={`text-sm font-semibold capitalize ${
                txType === t
                  ? t === 'expense'
                    ? 'text-red-600 dark:text-red-400'
                    : t === 'income'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-sky-600 dark:text-sky-400'
                  : 'text-muted'
              }`}
            >
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FieldRow label="Amount">
        <View className="flex-1 flex-row items-center justify-end gap-2">
          <Text className="text-sm font-semibold text-muted">{displayCurrency}</Text>
          <TextInput
            className="min-w-[96px] flex-1 rounded-lg border border-border bg-card px-3 py-2 text-right text-base font-semibold"
            style={{ color: amountColor }}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
        </View>
      </FieldRow>

      <FieldRow label={isTransfer ? 'From wallet' : 'Wallet'}>
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-end rounded-lg border border-border bg-card px-3 py-2"
          onPress={() => {
            setShowTransferToPicker(false);
            setShowWalletPicker(!showWalletPicker);
          }}
          activeOpacity={0.7}
        >
          <Text
            className={`text-sm ${
              selectedWallet
                ? 'text-foreground'
                : 'text-muted'
            }`}
          >
            {selectedWallet?.name ?? 'Select wallet...'}
          </Text>
          <Text className="ml-2 text-xs text-muted">▼</Text>
        </TouchableOpacity>
      </FieldRow>

      {showWalletPicker && (
        <View className="mb-4 overflow-hidden rounded-xl border border-border bg-card">
          {wallets.map((w) => (
            <Pressable
              key={w.id}
              className={`border-b border-border px-4 py-3 ${
                w.id === selectedWalletId ? 'bg-primary-muted' : ''
              }`}
              onPress={() => {
                setSelectedWalletId(w.id);
                setShowWalletPicker(false);
              }}
            >
              <Text className="text-sm font-medium text-foreground">{w.name}</Text>
              <Text className="text-xs capitalize text-muted">
                {w.type} · {w.currency}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {isTransfer ? (
        <>
          <FieldRow label="To wallet">
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-end rounded-lg border border-border bg-card px-3 py-2"
              onPress={() => {
                setShowWalletPicker(false);
                setShowTransferToPicker(!showTransferToPicker);
              }}
              activeOpacity={0.7}
            >
              <Text
                className={`text-sm ${
                  selectedTransferToWallet
                    ? 'text-foreground'
                    : 'text-muted'
                }`}
              >
                {selectedTransferToWallet?.name ?? 'Select destination...'}
              </Text>
              <Text className="ml-2 text-xs text-muted">▼</Text>
            </TouchableOpacity>
          </FieldRow>

          {showTransferToPicker && (
            <View className="mb-4 overflow-hidden rounded-xl border border-border bg-card">
              {destinationWallets.length === 0 ? (
                <Text className="px-4 py-3 text-sm text-muted">
                  Add another wallet to complete this transfer.
                </Text>
              ) : (
                destinationWallets.map((w) => (
                  <Pressable
                    key={w.id}
                    className={`border-b border-border px-4 py-3 ${
                      w.id === selectedTransferToWalletId ? 'bg-primary-muted' : ''
                    }`}
                    onPress={() => {
                      setSelectedTransferToWalletId(w.id);
                      setShowTransferToPicker(false);
                    }}
                  >
                    <Text className="text-sm font-medium text-foreground">
                      {w.name}
                    </Text>
                    <Text className="text-xs capitalize text-muted">
                      {w.type} · {w.currency}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          )}
        </>
      ) : null}

      {!isTransfer ? (
        <FieldRow label="Merchant">
          <TextInput
            className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-right text-sm text-foreground"
            value={merchant}
            onChangeText={setMerchant}
            placeholder="optional"
            placeholderTextColor={tokens.muted}
          />
        </FieldRow>
      ) : null}

      <FieldRow label="Description">
        <TextInput
          className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-right text-sm text-foreground"
          value={description}
          onChangeText={setDescription}
          placeholder="optional"
          placeholderTextColor={tokens.muted}
        />
      </FieldRow>

      <FieldRow label="Date">
        <TextInput
          className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-right text-sm text-foreground"
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={tokens.muted}
        />
      </FieldRow>

      {proposal.aiReasoning && (
        <AIReasoningSection
          reasoning={proposal.aiReasoning}
          confidence={proposal.aiConfidence}
        />
      )}

      <View className="flex-row mt-6 gap-3">
        <TouchableOpacity
          className="flex-1 items-center rounded-xl border border-border bg-card py-4"
          onPress={onReject}
          disabled={isActioning}
          activeOpacity={0.7}
        >
          {isActioning ? (
            <ActivityIndicator size="small" color={tokens.muted} />
          ) : (
            <Text className="text-base font-semibold text-foreground">
              Decline
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 items-center rounded-xl py-4 ${
            canApprove ? 'bg-primary' : 'bg-primary/60'
          }`}
          onPress={handleApprovePress}
          disabled={isActioning}
          activeOpacity={0.7}
        >
          {isActioning ? (
            <ActivityIndicator size="small" color={tokens.primaryForeground} />
          ) : (
            <Text className="text-base font-semibold text-primary-foreground">
              {canApprove ? 'Approve' : isTransfer ? 'Select wallets' : 'Select Wallet'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center mb-3">
      <Text className="w-24 text-sm text-muted">{label}</Text>
      {children}
    </View>
  );
}

function ProposalLocationSection({ proposalId }: { proposalId: string }) {
  const tokens = useThemeTokens();
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
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted">
          Captured location {expanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>
      {expanded ? (
        <View className="mt-2">
          <View
            className="overflow-hidden rounded-xl border border-border bg-background-muted"
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
                pinColor={tokens.primary}
              />
            </MapView>
          </View>
          {snapshot.name ? (
            <Text className="mt-2 text-xs text-muted" numberOfLines={3}>
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
        <Text className="text-xs font-medium text-muted">
          AI Analysis {expanded ? '▲' : '▼'}
        </Text>
        {confidence !== null && (
          <View className="ml-2 rounded bg-background-muted px-2 py-0.5">
            <Text className="text-xs text-muted">
              {Math.round(confidence * 100)}% confidence
            </Text>
          </View>
        )}
      </TouchableOpacity>
      {expanded && (
        <Text className="mt-2 text-xs leading-4 text-muted">
          {reasoning}
        </Text>
      )}
    </View>
  );
}
