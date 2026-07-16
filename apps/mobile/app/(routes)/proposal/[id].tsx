import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import type { ProposedTransaction } from '@repo/types';
import { BrandHeader } from '@/components/ui/brand-header';
import { ScreenShell } from '@/components/ui/screen-shell';
import { chipClass, chipTextClass } from '@/components/ui/chip';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { getProposalLocationSnapshot } from '@/lib/ai/proposal-location-cache';
import {
  isoToLocalDateInput,
  localDateInputToIso,
  parseLocalDateInput,
} from '@/lib/dates/local-date-input';
import {
  approveProposedTransaction,
  getProposedTransactions,
  rejectProposedTransaction,
} from '@/lib/supabase/proposed-transactions';
import { getWallets } from '@/lib/supabase/wallets';
import { getDefaultWalletId } from '@/lib/wallets/default-wallet';
import {
  displayCurrencyForProposal,
  resolveInitialWalletId,
} from '@/lib/wallets/proposal-wallet';

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

export default function ProposalDetailScreen() {
  const tokens = useThemeTokens();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const proposalId = useMemo(() => {
    const x = params.id;
    return Array.isArray(x) ? x[0] : x;
  }, [params.id]);

  const [proposal, setProposal] = useState<ProposedTransaction | null>(null);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isActioning, setIsActioning] = useState(false);

  const loadData = useCallback(async () => {
    if (!proposalId) {
      setLoadError('Proposal not found.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const [pending, ws] = await Promise.all([getProposedTransactions(), getWallets()]);
      const found = pending.find((p) => p.id === proposalId) ?? null;
      setProposal(found);
      setWallets(
        ws.map((w) => ({
          id: w.id,
          name: w.name ?? 'Wallet',
          type: w.type ?? 'other',
          currency: w.currency ?? 'MYR',
        })),
      );
      if (!found) setLoadError('Proposal not found or already reviewed.');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load proposal.');
    } finally {
      setIsLoading(false);
    }
  }, [proposalId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleApprove = useCallback(
    async (edited: EditedFields) => {
      if (!proposal || isActioning) return;

      const effectiveType = edited.type ?? proposal.type ?? 'expense';
      const walletId = edited.walletId ?? proposal.walletId;
      const transferToWalletId = edited.transferToWalletId ?? proposal.transferToWalletId;

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
        if (fromWallet && toWallet && fromWallet.currency.toUpperCase() !== toWallet.currency.toUpperCase()) {
          Alert.alert('Cannot approve', 'Transfers require both wallets to use the same currency.');
          return;
        }
      }

      const transactionDateIso = edited.date
        ? localDateInputToIso(edited.date)
        : proposal.transactionDate;
      if (edited.date && !transactionDateIso) {
        Alert.alert('Cannot approve', 'Enter a valid date (YYYY-MM-DD).');
        return;
      }

      setIsActioning(true);
      try {
        const updatedProposal: ProposedTransaction = {
          ...proposal,
          amount: edited.amount,
          type: effectiveType,
          merchant: effectiveType === 'transfer' ? null : edited.merchant || null,
          description: edited.description || null,
          transactionDate: transactionDateIso,
        };

        await approveProposedTransaction(updatedProposal, {
          walletId,
          transferToWalletId: effectiveType === 'transfer' ? transferToWalletId : null,
        });
        router.back();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to approve';
        console.error('[ProposalDetail] approve error:', e);
        Alert.alert('Error', message);
      } finally {
        setIsActioning(false);
      }
    },
    [proposal, isActioning, wallets],
  );

  const handleReject = useCallback(async () => {
    if (!proposal || isActioning) return;
    setIsActioning(true);
    try {
      await rejectProposedTransaction(proposal.id);
      router.back();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to reject';
      console.error('[ProposalDetail] reject error:', e);
      Alert.alert('Error', message);
    } finally {
      setIsActioning(false);
    }
  }, [proposal, isActioning]);

  return (
    <ScreenShell variant="canvas">
      <BrandHeader title="Review proposal" />
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={tokens.primary} />
        </View>
      ) : loadError || !proposal ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base text-muted">{loadError ?? 'Proposal not found.'}</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-8 pt-4"
          showsVerticalScrollIndicator={false}
        >
          <ProposalForm
            proposal={proposal}
            wallets={wallets}
            isActioning={isActioning}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </ScrollView>
      )}
    </ScreenShell>
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
  const [date, setDate] = useState(() => isoToLocalDateInput(proposal.transactionDate));
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
    setDate(isoToLocalDateInput(proposal.transactionDate));
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
    text: 'From text input',
    image: 'From receipt photo',
    notification: `From ${proposal.sourceApp ?? 'notification'}`,
  }[proposal.sourceType ?? 'notification'];

  const canApprove = !!selectedWalletId && (!isTransfer || !!selectedTransferToWalletId);

  const handleApprovePress = () => {
    const parsedAmount = parseFloat(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Cannot approve', 'Enter a valid positive amount.');
      return;
    }
    if (!parseLocalDateInput(date)) {
      Alert.alert('Cannot approve', 'Enter a valid date (YYYY-MM-DD).');
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
      <View className="mb-4 rounded-2xl bg-background-muted px-4 py-3">
        <Text className="text-sm text-muted">{sourceLabel}</Text>
        {proposal.sourceText ? (
          <Text className="mt-1 text-sm text-foreground" numberOfLines={3}>
            &ldquo;{proposal.sourceText}&rdquo;
          </Text>
        ) : null}
        {proposal.sourceImageUri ? (
          <Image
            source={{ uri: proposal.sourceImageUri }}
            style={{ width: '100%', height: 160, borderRadius: 12, marginTop: 8 }}
            contentFit="cover"
          />
        ) : null}
        {proposal.sourceType === 'notification' && proposal.notificationBody ? (
          <Text className="mt-1 text-sm text-foreground" numberOfLines={3}>
            {proposal.notificationTitle}: {proposal.notificationBody}
          </Text>
        ) : null}
      </View>

      <ProposalLocationSection proposalId={proposal.id} />

      <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
        Transaction type
      </Text>
      <View className="mb-4 flex-row gap-1.5">
        {TX_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            className={`${chipClass(txType === t)} flex-1 items-center py-2.5`}
            onPress={() => setTxType(t)}
            activeOpacity={0.85}>
            <Text className={`text-sm font-semibold capitalize ${chipTextClass(txType === t)}`}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FieldRow label="Amount">
        <View className="flex-1 flex-row items-center justify-end gap-2">
          <Text className="text-sm font-semibold text-muted">{displayCurrency}</Text>
          <TextInput
            className="min-w-[96px] flex-1 rounded-xl border border-border bg-card px-3 py-2 text-right text-base font-semibold"
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
          className="flex-1 flex-row items-center justify-end rounded-xl border border-border bg-card px-3 py-2"
          onPress={() => {
            setShowTransferToPicker(false);
            setShowWalletPicker(!showWalletPicker);
          }}
          activeOpacity={0.7}>
          <Text className={`text-sm ${selectedWallet ? 'text-foreground' : 'text-muted'}`}>
            {selectedWallet?.name ?? 'Select wallet...'}
          </Text>
          <Text className="ml-2 text-xs text-muted">▼</Text>
        </TouchableOpacity>
      </FieldRow>

      {showWalletPicker ? (
        <View className="mb-4 overflow-hidden rounded-2xl border border-border bg-card">
          {wallets.map((w) => (
            <Pressable
              key={w.id}
              className={`border-b border-border px-4 py-3 ${w.id === selectedWalletId ? 'bg-primary-muted' : ''}`}
              onPress={() => {
                setSelectedWalletId(w.id);
                setShowWalletPicker(false);
              }}>
              <Text className="text-sm font-medium text-foreground">{w.name}</Text>
              <Text className="text-xs capitalize text-muted">
                {w.type} · {w.currency}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {isTransfer ? (
        <>
          <FieldRow label="To wallet">
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-end rounded-xl border border-border bg-card px-3 py-2"
              onPress={() => {
                setShowWalletPicker(false);
                setShowTransferToPicker(!showTransferToPicker);
              }}
              activeOpacity={0.7}>
              <Text className={`text-sm ${selectedTransferToWallet ? 'text-foreground' : 'text-muted'}`}>
                {selectedTransferToWallet?.name ?? 'Select destination...'}
              </Text>
              <Text className="ml-2 text-xs text-muted">▼</Text>
            </TouchableOpacity>
          </FieldRow>

          {showTransferToPicker ? (
            <View className="mb-4 overflow-hidden rounded-2xl border border-border bg-card">
              {destinationWallets.length === 0 ? (
                <Text className="px-4 py-3 text-sm text-muted">
                  Add another wallet to complete this transfer.
                </Text>
              ) : (
                destinationWallets.map((w) => (
                  <Pressable
                    key={w.id}
                    className={`border-b border-border px-4 py-3 ${w.id === selectedTransferToWalletId ? 'bg-primary-muted' : ''
                      }`}
                    onPress={() => {
                      setSelectedTransferToWalletId(w.id);
                      setShowTransferToPicker(false);
                    }}>
                    <Text className="text-sm font-medium text-foreground">{w.name}</Text>
                    <Text className="text-xs capitalize text-muted">
                      {w.type} · {w.currency}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          ) : null}
        </>
      ) : null}

      {!isTransfer ? (
        <FieldRow label="Merchant">
          <TextInput
            className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-right text-sm text-foreground"
            value={merchant}
            onChangeText={setMerchant}
            placeholder="optional"
            placeholderTextColor={tokens.muted}
          />
        </FieldRow>
      ) : null}

      <FieldRow label="Description">
        <TextInput
          className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-right text-sm text-foreground"
          value={description}
          onChangeText={setDescription}
          placeholder="optional"
          placeholderTextColor={tokens.muted}
        />
      </FieldRow>

      <FieldRow label="Date">
        <TextInput
          className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-right text-sm text-foreground"
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={tokens.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </FieldRow>

      {proposal.aiReasoning ? (
        <AIReasoningSection reasoning={proposal.aiReasoning} confidence={proposal.aiConfidence} />
      ) : null}

      <View className="mt-6 flex-row gap-3">
        <TouchableOpacity
          className="flex-1 items-center rounded-xl border border-border bg-card py-4"
          onPress={onReject}
          disabled={isActioning}
          activeOpacity={0.7}>
          {isActioning ? (
            <ActivityIndicator size="small" color={tokens.muted} />
          ) : (
            <Text className="text-base font-semibold text-foreground">Decline</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 items-center rounded-xl py-4 ${canApprove ? 'bg-primary' : 'bg-primary/60'}`}
          onPress={handleApprovePress}
          disabled={isActioning}
          activeOpacity={0.7}>
          {isActioning ? (
            <ActivityIndicator size="small" color={tokens.primaryForeground} />
          ) : (
            <Text className="text-base font-semibold text-primary-foreground">
              {canApprove ? 'Approve' : isTransfer ? 'Select wallets' : 'Select wallet'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="mb-3 flex-row items-center">
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
        activeOpacity={0.7}>
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted">
          Captured location {expanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>
      {expanded ? (
        <View className="mt-2">
          <View
            className="overflow-hidden rounded-2xl border border-border bg-background-muted"
            style={styles.locationMapBox}>
            <MapView
              style={styles.locationMap}
              initialRegion={region}
              provider="google"
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}>
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
        activeOpacity={0.7}>
        <Text className="text-xs font-medium text-muted">AI analysis {expanded ? '▲' : '▼'}</Text>
        {confidence !== null ? (
          <View className="ml-2 rounded bg-background-muted px-2 py-0.5">
            <Text className="text-xs text-muted">{Math.round(confidence * 100)}% confidence</Text>
          </View>
        ) : null}
      </TouchableOpacity>
      {expanded ? <Text className="mt-2 text-xs leading-4 text-muted">{reasoning}</Text> : null}
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
