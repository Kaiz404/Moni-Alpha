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
import { Surface } from '@/components/ui/surface';
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

export type CategoryOption = {
  id: string;
  name: string;
  icon: string | null;
  type: string | null;
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
  categoryId: string | null;
  merchant: string;
  description: string;
  date: string;
};

export function ProposalForm({
  proposal,
  wallets,
  categories,
  isActioning,
  onApprove,
  onReject,
}: {
  proposal: ProposedTransaction;
  wallets: WalletOption[];
  categories: CategoryOption[];
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    string | null
  >(proposal.categoryId);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [showTransferToPicker, setShowTransferToPicker] =
    useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

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
    setSelectedCategoryId(proposal.categoryId);
    setShowWalletPicker(false);
    setShowTransferToPicker(false);
    setShowCategoryPicker(false);
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
  const categoryOptions = useMemo(
    () =>
      categories.filter((category) =>
        txType === 'income'
          ? category.type === 'income'
          : category.type === 'expense',
      ),
    [categories, txType],
  );
  const selectedCategory = categoryOptions.find(
    (category) => category.id === selectedCategoryId,
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
  const sourceTitle =
    proposal.sourceType === 'image'
      ? 'Receipt capture'
      : proposal.sourceType === 'text'
        ? 'From Moni chat'
        : 'Notification capture';

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
      categoryId: isTransfer ? null : selectedCategoryId,
      merchant,
      description,
      date,
    });
  };

  return (
    <View accessibilityLabel="Transaction proposal review">
      <Surface
        tone="muted"
        className="mb-5 px-4 py-4"
      >
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
          {sourceTitle}
        </Text>
        <Text className="mt-1 text-base font-bold text-foreground">
          {sourceLabel}
        </Text>
        {proposal.sourceText ? (
          <Text
            className="mt-2 text-sm leading-5 text-muted"
            numberOfLines={2}
          >
            &ldquo;{proposal.sourceText}&rdquo;
          </Text>
        ) : null}
        {proposal.sourceType === 'notification' &&
        proposal.notificationBody ? (
          <Text
            className="mt-2 text-sm leading-5 text-muted"
            numberOfLines={2}
          >
            {proposal.notificationTitle}: {proposal.notificationBody}
          </Text>
        ) : null}
      </Surface>

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

      <View className="mb-5 border-b border-border-subtle pb-5">
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
          Proposed amount
        </Text>
        <View className="mt-2 flex-row items-end justify-between gap-3">
          <Text className="pb-3 text-sm font-semibold text-muted">
            {displayCurrency}
          </Text>
          <TextInput
            accessibilityLabel="Amount"
            className="min-w-[120px] flex-1 border-b border-border bg-transparent px-1 py-1 text-right text-4xl font-bold"
            style={{ color: amountColor }}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
        </View>
      </View>

      <FieldRow label={isTransfer ? 'From wallet' : 'Wallet'}>
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-end rounded-2xl border border-border bg-card px-3 py-3"
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
        <Surface className="mb-4 overflow-hidden rounded-[22px]">
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
        </Surface>
      ) : null}

      {isTransfer ? (
        <>
          <FieldRow label="To wallet">
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-end rounded-2xl border border-border bg-card px-3 py-3"
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
            <Surface className="mb-4 overflow-hidden rounded-[22px]">
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
            </Surface>
          ) : null}
        </>
      ) : null}

      {!isTransfer ? (
        <>
          <FieldRow label="Category">
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-end rounded-2xl border border-border bg-card px-3 py-3"
              onPress={() => {
                setShowWalletPicker(false);
                setShowTransferToPicker(false);
                setShowCategoryPicker(!showCategoryPicker);
              }}
              activeOpacity={0.7}
            >
              <Text
                className={`text-sm ${selectedCategory ? 'text-foreground' : 'text-muted'}`}
              >
                {selectedCategory
                  ? `${selectedCategory.icon ?? '•'} ${selectedCategory.name}`
                  : (proposal.categoryHint ?? 'Select category...')}
              </Text>
              <Text className="ml-2 text-xs text-muted">▼</Text>
            </TouchableOpacity>
          </FieldRow>

          {showCategoryPicker ? (
            <Surface className="mb-4 overflow-hidden rounded-[22px]">
              {categoryOptions.length === 0 ? (
                <Text className="px-4 py-3 text-sm text-muted">
                  No matching categories are available yet.
                </Text>
              ) : (
                categoryOptions.map((category) => (
                  <Pressable
                    key={category.id}
                    className={`border-b border-border px-4 py-3 ${
                      category.id === selectedCategoryId
                        ? 'bg-primary-muted'
                        : ''
                    }`}
                    onPress={() => {
                      setSelectedCategoryId(category.id);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text className="text-sm font-medium text-foreground">
                      {category.icon ?? '•'} {category.name}
                    </Text>
                  </Pressable>
                ))
              )}
            </Surface>
          ) : null}
        </>
      ) : null}

      {!isTransfer ? (
        <FieldRow label="Merchant">
          <TextInput
            accessibilityLabel="Merchant"
            className="flex-1 rounded-2xl border border-border bg-card px-3 py-3 text-right text-sm text-foreground"
            value={merchant}
            onChangeText={setMerchant}
            placeholder="optional"
            placeholderTextColor={tokens.muted}
          />
        </FieldRow>
      ) : null}

      <FieldRow label="Description">
        <TextInput
          accessibilityLabel="Description"
          className="flex-1 rounded-2xl border border-border bg-card px-3 py-3 text-right text-sm text-foreground"
          value={description}
          onChangeText={setDescription}
          placeholder="optional"
          placeholderTextColor={tokens.muted}
        />
      </FieldRow>

      <FieldRow label="Date">
        <TextInput
          accessibilityLabel="Transaction date"
          className="flex-1 rounded-2xl border border-border bg-card px-3 py-3 text-right text-sm text-foreground"
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

      {proposal.sourceImageUri ? (
        <View className="mt-5">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Receipt evidence
          </Text>
          <Image
            source={{ uri: proposal.sourceImageUri }}
            style={{ width: '100%', height: 180, borderRadius: 22 }}
            contentFit="cover"
            accessibilityLabel="Receipt image evidence"
          />
        </View>
      ) : null}

      <ProposalLocationSection proposalId={proposal.id} />

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
