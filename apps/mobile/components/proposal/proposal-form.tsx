import { useEffect, useMemo, useState } from 'react';
import { useValue } from '@legendapp/state/react';
import {
  ActivityIndicator,
  Alert,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { Image } from 'expo-image';
import {
  minorToDecimal,
  type ProposedTransaction,
} from '@repo/types';

import { AiReasoningSection } from '@/components/proposal/ai-reasoning-section';
import { FieldRow } from '@/components/proposal/field-row';
import { ProposalLocationSection } from '@/components/proposal/proposal-location-section';
import { CategoryIcon } from '@/components/categories/category-icon';
import { chipClass, chipTextClass } from '@/components/ui/chip';
import { PickerField } from '@/components/ui/picker-field';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { parseAmountInput } from '@/lib/finance/money';
import { budgetProgress$ } from '@/lib/finance/selectors';
import { toCategoryTiles } from '@/lib/sheet/category-tiles';
import { openSheet } from '@/lib/sheet/sheet-store';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';
import {
  isoToLocalDateInput,
  parseLocalDateInput,
} from '@/lib/dates/local-date-input';
import { getDefaultWalletId } from '@/lib/wallets/default-wallet';
import {
  displayCurrencyForProposal,
  resolveInitialWalletId,
} from '@/lib/wallets/proposal-wallet';
import { tid } from '@/lib/test-ids';

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
  color: string | null;
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
  const { user } = useAuth();
  const [timezone, setTimezone] = useState('UTC');
  const progress = useValue(budgetProgress$(user?.id ?? null, timezone));
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
  const [focusedField, setFocusedField] = useState<
    'merchant' | 'description' | 'date' | null
  >(null);

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
  }, [proposal, wallets]);

  useEffect(() => {
    void ensureFinanceTimezone()
      .then(setTimezone)
      .catch(() => {});
  }, []);

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

  const pickWallet = async (role: 'source' | 'destination') => {
    const destination = role === 'destination';
    const pick = await openSheet({
      kind: 'wallet',
      title: destination ? 'Move to' : isTransfer ? 'From wallet' : 'Paid from',
      wallets: (destination ? destinationWallets : wallets).map((wallet) => ({
        ...wallet,
        icon: null,
        color: null,
        cardStyleId: null,
      })),
      selectedId: destination ? selectedTransferToWalletId : selectedWalletId,
      emptyMessage: destination
        ? 'Add another wallet to complete this transfer.'
        : undefined,
    });
    if (!pick?.walletId) return;
    if (destination) setSelectedTransferToWalletId(pick.walletId);
    else setSelectedWalletId(pick.walletId);
  };

  const pickCategory = async () => {
    const picked = await openSheet({
      kind: 'category',
      title: 'Choose category',
      currency: displayCurrency,
      categories: toCategoryTiles(categoryOptions, progress, displayCurrency),
      selectedId: selectedCategoryId,
    });
    if (picked) setSelectedCategoryId(picked);
  };

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
      void pickWallet('source');
      return;
    }
    if (isTransfer && !selectedTransferToWalletId) {
      void pickWallet('destination');
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
      <View className="rounded-card bg-sand mb-5 px-4 py-4 overflow-hidden">
        <Text className="text-xs font-display-semibold uppercase tracking-wide text-muted">
          {sourceTitle}
        </Text>
        <Text className="mt-1 text-base font-display-bold text-foreground">
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
      </View>

      <Text className="mb-2 text-xs font-display-semibold uppercase tracking-wider text-muted">
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
              className={`text-sm font-display-semibold capitalize ${chipTextClass(txType === t)}`}
            >
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="mb-5 border-b border-border-subtle pb-5">
        <Text className="text-xs font-display-semibold uppercase tracking-wide text-muted">
          Proposed amount
        </Text>
        <View className="mt-2 flex-row items-end justify-between gap-3">
          <Text className="pb-3 text-sm font-display-semibold text-muted">
            {displayCurrency}
          </Text>
          <TextInput
            testID={tid('review', 'amount')}
            accessibilityLabel="Amount"
            className="min-w-[120px] flex-1 border-b border-border bg-transparent px-1 py-1 text-right text-4xl font-display-bold"
            style={{ color: amountColor }}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
        </View>
      </View>

      <View className="mb-4 gap-2">
        <PickerField
          testID={tid('review', 'wallet')}
          label={isTransfer ? 'From wallet' : 'Paid from'}
          value={selectedWallet?.name ?? ''}
          onPress={() => void pickWallet('source')}
        />
        {isTransfer ? (
          <PickerField
            testID={tid('review', 'destination')}
            label="Move to"
            value={selectedTransferToWallet?.name ?? ''}
            onPress={() => void pickWallet('destination')}
          />
        ) : (
          <PickerField
            testID={tid('review', 'category')}
            label="Category"
            value={selectedCategory?.name ?? proposal.categoryHint ?? ''}
            leading={
              selectedCategory ? (
                <CategoryIcon
                  color={tokens.foreground}
                  icon={selectedCategory.icon}
                  size={20}
                />
              ) : undefined
            }
            onPress={() => void pickCategory()}
          />
        )}
      </View>

      {!isTransfer ? (
        <FieldRow label="Merchant">
          <TextInput
            testID={tid('review', 'merchant')}
            accessibilityLabel="Merchant"
            className={`flex-1 rounded-2xl bg-card px-3 py-3 text-right text-sm text-foreground ${
              focusedField === 'merchant'
                ? 'border border-primary'
                : ''
            }`}
            value={merchant}
            onChangeText={setMerchant}
            placeholder="optional"
            onFocus={() => setFocusedField('merchant')}
            onBlur={() => setFocusedField(null)}
            placeholderTextColor={tokens.muted}
          />
        </FieldRow>
      ) : null}

      <FieldRow label="Description">
        <TextInput
          testID={tid('review', 'description')}
          accessibilityLabel="Description"
          className={`flex-1 rounded-2xl bg-card px-3 py-3 text-right text-sm text-foreground ${
            focusedField === 'description'
              ? 'border border-primary'
              : ''
          }`}
          value={description}
          onChangeText={setDescription}
          placeholder="optional"
          onFocus={() => setFocusedField('description')}
          onBlur={() => setFocusedField(null)}
          placeholderTextColor={tokens.muted}
        />
      </FieldRow>

      <FieldRow label="Date">
        <TextInput
          testID={tid('review', 'transaction-date')}
          accessibilityLabel="Transaction date"
          className={`flex-1 rounded-2xl bg-card px-3 py-3 text-right text-sm text-foreground ${
            focusedField === 'date' ? 'border border-primary' : ''
          }`}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          onFocus={() => setFocusedField('date')}
          onBlur={() => setFocusedField(null)}
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
          <Text className="mb-2 text-xs font-display-semibold uppercase tracking-wide text-muted">
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
          className="flex-1 items-center rounded-xl bg-surface-2 py-4"
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
            <Text className="text-base font-display-semibold text-foreground">
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
            <Text className="text-base font-display-semibold text-primary-foreground">
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
