import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, DeviceEventEmitter, Modal, Pressable, Text, View } from 'react-native';
import { usePathname, router } from 'expo-router';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import type { ProposedTransaction } from '@repo/types';
import {
  getProposedTransactions,
  approveProposedTransaction,
  rejectProposedTransaction,
} from '@/lib/supabase/proposed-transactions';
import { PROPOSED_TRANSACTIONS_CHANGED } from '@/lib/proposals/proposed-transactions-events';
import { getWallets } from '@/lib/supabase/wallets';
import { getCategoryNameRows } from '@/lib/supabase/categories';
import { getDefaultWalletId } from '@/lib/wallets/default-wallet';
import { displayCurrencyForProposal, resolveInitialWalletId } from '@/lib/wallets/proposal-wallet';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  getFabReceiptProcessingProposalId,
  stopFabReceiptProcessing,
} from '@/lib/receipts/fab-receipt-processing';

type WalletOption = { id: string; name: string; type: string; currency: string };

const SOURCE_ICON: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  text: 'chat-bubble-outline',
  image: 'photo-camera',
  notification: 'notifications-none',
};

/**
 * Minimal "here's what Moni found" popup shown after AI extraction finishes.
 * Kept intentionally light — full editing lives at /proposal/[id].
 */
export function ProposalSummarySheet() {
  const tokens = useThemeTokens();
  const pathname = usePathname();
  const [proposals, setProposals] = useState<ProposedTransaction[]>([]);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const proposalsRef = useRef(proposals);
  proposalsRef.current = proposals;
  const appStateRef = useRef(AppState.currentState);
  /** IDs removed locally while delete/approve syncs — prevents reload races from re-showing the sheet. */
  const handledIdsRef = useRef(new Set<string>());

  const withoutHandled = useCallback(
    (rows: ProposedTransaction[]) => rows.filter((p) => !handledIdsRef.current.has(p.id)),
    [],
  );

  const loadData = useCallback(async () => {
    const quietRefresh = proposalsRef.current.length > 0;
    if (!quietRefresh) setIsLoading(true);
    try {
      const [pending, ws, categoryRows] = await Promise.all([
        getProposedTransactions(),
        getWallets(),
        getCategoryNameRows(),
      ]);
      setProposals(withoutHandled(pending));
      setWallets(
        ws.map((w) => ({
          id: w.id,
          name: w.name ?? 'Wallet',
          type: w.type ?? 'other',
          currency: w.currency ?? 'MYR',
        })),
      );
      setCategoryNames(
        Object.fromEntries(categoryRows.map((row) => [row.id, row.name ?? 'Uncategorized'])),
      );
    } catch (e) {
      console.warn('[ProposalSummary] load error:', e);
    } finally {
      if (!quietRefresh) setIsLoading(false);
    }
  }, [withoutHandled]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(PROPOSED_TRANSACTIONS_CHANGED, () => loadData());
    return () => sub.remove();
  }, [loadData]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') loadData();
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [loadData]);

  const current = proposals[0];
  /** Hide while the full detail page is open to avoid a native Modal covering the pushed route. */
  const suppressed = pathname.startsWith('/proposal');
  const visible = proposals.length > 0 && !isLoading && !!current && !suppressed;

  useEffect(() => {
    if (!visible || !current) return;
    const pendingFabProposalId = getFabReceiptProcessingProposalId();
    if (pendingFabProposalId && pendingFabProposalId === current.id) {
      stopFabReceiptProcessing();
    }
  }, [visible, current?.id]);

  const resolvedWalletId = useMemo(() => {
    if (!current) return null;
    return resolveInitialWalletId(current, wallets, getDefaultWalletId());
  }, [current, wallets]);

  const resolvedWallet = wallets.find((w) => w.id === resolvedWalletId);
  const displayCurrency = current
    ? displayCurrencyForProposal({ walletId: resolvedWalletId, currency: current.currency }, wallets, getDefaultWalletId())
    : '';

  const isTransfer = current?.type === 'transfer';
  const isIncome = current?.type === 'income';
  const amountColor = isTransfer ? tokens.transfer : isIncome ? tokens.income : tokens.expense;
  const categoryLabel = current?.categoryId
    ? categoryNames[current.categoryId]
    : current?.categoryHint ?? null;
  const canQuickApprove = !isTransfer && !!resolvedWalletId;

  const removeProposal = useCallback((id: string) => {
    handledIdsRef.current.add(id);
    setProposals((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleReject = useCallback(async () => {
    if (!current || isActioning) return;
    const id = current.id;
    removeProposal(id);
    setIsActioning(true);
    try {
      await rejectProposedTransaction(id);
    } catch (e) {
      handledIdsRef.current.delete(id);
      console.error('[ProposalSummary] reject error:', e);
      await loadData();
    } finally {
      setIsActioning(false);
    }
  }, [current, isActioning, removeProposal, loadData]);

  const handleApprove = useCallback(async () => {
    if (!current || isActioning || !resolvedWalletId) return;
    const id = current.id;
    removeProposal(id);
    setIsActioning(true);
    try {
      await approveProposedTransaction(current, { walletId: resolvedWalletId });
    } catch (e) {
      handledIdsRef.current.delete(id);
      console.error('[ProposalSummary] approve error:', e);
      await loadData();
    } finally {
      setIsActioning(false);
    }
  }, [current, isActioning, resolvedWalletId, removeProposal, loadData]);

  const handleEditDetails = useCallback(() => {
    if (!current) return;
    router.push({ pathname: '/proposal/[id]', params: { id: current.id } } as any);
  }, [current]);

  if (!visible) return null;

  const title =
    (isTransfer ? null : current.merchant) ||
    current.description ||
    (isTransfer ? 'Transfer' : isIncome ? 'Income' : 'Expense');

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={handleReject}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="flex-1" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        <View className="rounded-t-3xl bg-background px-6 pb-8 pt-5">
          <View className="mb-4 flex-row items-center gap-2">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-background-muted">
              <MaterialIcons
                name={SOURCE_ICON[current.sourceType ?? 'notification']}
                size={16}
                color={tokens.muted}
              />
            </View>
            <Text className="flex-1 text-sm font-medium text-muted">Moni found a transaction</Text>
            {proposals.length > 1 ? (
              <View className="rounded-full bg-background-muted px-2 py-0.5">
                <Text className="text-xs text-muted">+{proposals.length - 1} more</Text>
              </View>
            ) : null}
          </View>

          <Text className="text-sm text-muted" numberOfLines={1}>
            {title}
          </Text>
          <View className="mt-1 flex-row items-baseline gap-2">
            <Text className="text-4xl font-bold" style={{ color: amountColor }}>
              {isTransfer ? '' : isIncome ? '+' : '-'}
              {(current.amount ?? 0).toFixed(2)}
            </Text>
            <Text className="text-base font-medium text-muted">{displayCurrency}</Text>
          </View>

          <View className="mt-4 flex-row items-center gap-2">
            <View className="flex-row items-center gap-1.5 rounded-full bg-background-muted px-3 py-1.5">
              <MaterialIcons name="account-balance-wallet" size={14} color={tokens.muted} />
              <Text className="text-xs font-medium text-foreground">
                {resolvedWallet?.name ?? 'Choose wallet'}
              </Text>
            </View>
            {categoryLabel ? (
              <View className="flex-row items-center gap-1.5 rounded-full bg-background-muted px-3 py-1.5">
                <MaterialIcons name="sell" size={14} color={tokens.muted} />
                <Text className="text-xs font-medium text-foreground">{categoryLabel}</Text>
              </View>
            ) : null}
          </View>

          <Pressable onPress={handleEditDetails} className="mt-4 self-start" hitSlop={6}>
            <Text className="text-sm font-semibold text-primary">Edit details</Text>
          </Pressable>

          <View className="mt-5 flex-row gap-3">
            <Pressable
              onPress={handleReject}
              disabled={isActioning}
              className="flex-1 items-center rounded-xl border border-border bg-card py-3.5">
              {isActioning ? (
                <ActivityIndicator size="small" color={tokens.muted} />
              ) : (
                <Text className="text-base font-semibold text-foreground">Decline</Text>
              )}
            </Pressable>
            <Pressable
              onPress={canQuickApprove ? handleApprove : handleEditDetails}
              disabled={isActioning}
              className={`flex-1 items-center rounded-xl py-3.5 ${canQuickApprove ? 'bg-primary' : 'bg-primary/60'}`}>
              {isActioning ? (
                <ActivityIndicator size="small" color={tokens.primaryForeground} />
              ) : (
                <Text className="text-base font-semibold text-primary-foreground">
                  {canQuickApprove ? 'Approve' : isTransfer ? 'Choose wallets' : 'Choose wallet'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
