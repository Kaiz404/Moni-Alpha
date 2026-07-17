import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import {
  minorToDecimal,
  type ProposedTransaction,
} from '@repo/types';

import { AiReasoningSection } from '@/components/proposal/ai-reasoning-section';
import { FieldRow } from '@/components/proposal/field-row';
import { ProposalLocationSection } from '@/components/proposal/proposal-location-section';
import { chipClass, chipTextClass } from '@/components/ui/chip';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { parseAmountInput } from '@/lib/finance/money';
import {
  isoToLocalDateInput,
  parseLocalDateInput,
} from '@/lib/dates/local-date-input';
import { getDefaultWalletId } from '@/lib/wallets/default-wallet';
import {
  displayCurrencyForProposal,
  resolveInitialWalletId,
} from '@/lib/wallets/proposal-wallet';

export type WalletOption = {
  id: string;
  name: string;
  type: string;
  currency: string;
};

const TX_TYPES = ['expense', 'income', 'transfer'] as const;
export type TxType = (typeof TX_TYPES)[number];

export function normalizeTxType(
  type: ProposedTransaction['type'],
): TxType {
  if (type === 'income' || type === 'expense' || type === 'transfer')
    return type;
  return 'expense';
}

export type EditedFields = {
  amountMinor: ReturnType<typeof parseAmountInput>;
  type: TxType;
  walletId: string | null;
  transferToWalletId: string | null;
  merchant: string;
  description: string;
  date: string;
};

export function ProposalForm({
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
  const [txType, setTxType] = useState<TxType>(
    normalizeTxType(proposal.type),
  );
  const [amount, setAmount] = useState(
    proposal.amountMinor != null
      ? minorToDecimal(proposal.amountMinor)
      : '0.00',
  );
  const [merchant, setMerchant] = useState(proposal.merchant ?? '');
  const [description, setDescription] = useState(
    proposal.description ?? '',
  );
  const [date, setDate] = useState(() =>
    isoToLocalDateInput(proposal.transactionDate),
  );
  const [selectedWalletId, setSelectedWalletId] = useState<
    string | null
  >(() =>
    resolveInitialWalletId(proposal, wallets, getDefaultWalletId()),
  );
  const [selectedTransferToWalletId, setSelectedTransferToWalletId] =
    useState<string | null>(proposal.transferToWalletId);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [showTransferToPicker, setShowTransferToPicker] =
    useState(false);

  const isTransfer = txType === 'transfer';
  const destinationWallets = useMemo(
    () => wallets.filter((w) => w.id !== selectedWalletId),
    [wallets, selectedWalletId],
  );

  useEffect(() => {
    setTxType(normalizeTxType(proposal.type));
    setAmount(
      proposal.amountMinor != null
        ? minorToDecimal(proposal.amountMinor)
        : '0.00',
    );
    setMerchant(proposal.merchant ?? '');
    setDescription(proposal.description ?? '');
    setDate(isoToLocalDateInput(proposal.transactionDate));
    setSelectedWalletId(
      resolveInitialWalletId(proposal, wallets, getDefaultWalletId()),
    );
    setSelectedTransferToWalletId(proposal.transferToWalletId);
    setShowWalletPicker(false);
    setShowTransferToPicker(false);
  }, [proposal, wallets]);

  useEffect(() => {
    if (!isTransfer) return;
    if (
      selectedTransferToWalletId &&
      selectedTransferToWalletId === selectedWalletId
    ) {
      setSelectedTransferToWalletId(null);
    }
  }, [isTransfer, selectedWalletId, selectedTransferToWalletId]);

  const selectedWallet = wallets.find(
    (w) => w.id === selectedWalletId,
  );
  const selectedTransferToWallet = wallets.find(
    (w) => w.id === selectedTransferToWalletId,
  );
  const displayCurrency = displayCurrencyForProposal(
    { walletId: selectedWalletId, currency: proposal.currency },
    wallets,
    getDefaultWalletId(),
  );
  const amountColor = isTransfer
    ? tokens.transfer
    : txType === 'expense'
      ? tokens.expense
      : tokens.income;
  const sourceLabel = {
    text: 'From text input',
    image: 'From receipt photo',
    notification: `From ${proposal.sourceApp ?? 'notification'}`,
  }[proposal.sourceType ?? 'notification'];

  const canApprove =
    !!selectedWalletId &&
    (!isTransfer || !!selectedTransferToWalletId);

  const handleApprovePress = () => {
    let amountMinor: ReturnType<typeof parseAmountInput>;
    try {
      amountMinor = parseAmountInput(amount);
    } catch {
      Alert.alert('Cannot approve', 'Enter a valid positive amount.');
      return;
    }
    if (!parseLocalDateInput(date)) {
      Alert.alert(
        'Cannot approve',
        'Enter a valid date (YYYY-MM-DD).',
      );
      return;
    }
    if (!selectedWalletId) {
      setShowWalletPicker(true);
      Alert.alert(
        'Select wallet',
        isTransfer ? 'Choose the source wallet.' : 'Choose a wallet.',
      );
      return;
    }
    if (isTransfer && !selectedTransferToWalletId) {
      setShowTransferToPicker(true);
      Alert.alert(
        'Select wallet',
        'Choose the destination wallet for this transfer.',
      );
      return;
    }
    onApprove({
      amountMinor,
      type: txType,
      walletId: selectedWalletId,
      transferToWalletId: isTransfer
        ? selectedTransferToWalletId
        : null,
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
          <Text
            className="mt-1 text-sm text-foreground"
            numberOfLines={3}
          >
            &ldquo;{proposal.sourceText}&rdquo;
          </Text>
        ) : null}
        {proposal.sourceImageUri ? (
          <Image
            source={{ uri: proposal.sourceImageUri }}
            style={{
              width: '100%',
              height: 160,
              borderRadius: 12,
              marginTop: 8,
            }}
            contentFit="cover"
          />
        ) : null}
        {proposal.sourceType === 'notification' &&
        proposal.notificationBody ? (
          <Text
            className="mt-1 text-sm text-foreground"
            numberOfLines={3}
          >
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
            activeOpacity={0.85}
          >
            <Text
              className={`text-sm font-semibold capitalize ${chipTextClass(txType === t)}`}
            >
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FieldRow label="Amount">
        <View className="flex-1 flex-row items-center justify-end gap-2">
          <Text className="text-sm font-semibold text-muted">
            {displayCurrency}
          </Text>
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
          activeOpacity={0.7}
        >
          <Text
            className={`text-sm ${selectedWallet ? 'text-foreground' : 'text-muted'}`}
          >
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
              }}
            >
              <Text className="text-sm font-medium text-foreground">
                {w.name}
              </Text>
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
              activeOpacity={0.7}
            >
              <Text
                className={`text-sm ${selectedTransferToWallet ? 'text-foreground' : 'text-muted'}`}
              >
                {selectedTransferToWallet?.name ??
                  'Select destination...'}
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
                    className={`border-b border-border px-4 py-3 ${
                      w.id === selectedTransferToWalletId
                        ? 'bg-primary-muted'
                        : ''
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
        <AiReasoningSection
          reasoning={proposal.aiReasoning}
          confidence={proposal.aiConfidence}
        />
      ) : null}

      <View className="mt-6 flex-row gap-3">
        <TouchableOpacity
          className="flex-1 items-center rounded-xl border border-border bg-card py-4"
          onPress={onReject}
          disabled={isActioning}
          activeOpacity={0.7}
        >
          {isActioning ? (
            <ActivityIndicator
              size="small"
              color={tokens.muted}
            />
          ) : (
            <Text className="text-base font-semibold text-foreground">
              Decline
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 items-center rounded-xl py-4 ${canApprove ? 'bg-primary' : 'bg-primary/60'}`}
          onPress={handleApprovePress}
          disabled={isActioning}
          activeOpacity={0.7}
        >
          {isActioning ? (
            <ActivityIndicator
              size="small"
              color={tokens.primaryForeground}
            />
          ) : (
            <Text className="text-base font-semibold text-primary-foreground">
              {canApprove
                ? 'Approve'
                : isTransfer
                  ? 'Select wallets'
                  : 'Select wallet'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
