import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  DeviceEventEmitter,
  Modal,
  Pressable,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { usePathname, router } from 'expo-router';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import {
  minorToDecimal,
  type ProposedTransaction,
} from '@repo/types';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { PROPOSED_TRANSACTIONS_CHANGED } from '@/lib/proposals/proposed-transactions-events';
import {
  proposalPresentationForSource,
  quietReviewCopy,
} from '@/lib/proposals/presentation-policy';
import {
  findProposalDuplicate,
  getProposedTransactions,
} from '@/lib/supabase/proposed-transactions';
import { Button } from '@/components/ui/button';
import { tid } from '@/lib/test-ids';

/**
 * Quiet notification-only entry to the review queue. User-initiated receipt
 * and Chat proposals bypass this sheet and open the full review artifact once
 * their transparent processing state is complete.
 */
export function ProposalSummarySheet() {
  const tokens = useThemeTokens();
  const pathname = usePathname();
  const [proposals, setProposals] = useState<ProposedTransaction[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const deferredIds = useRef(new Set<string>());
  const appState = useRef(AppState.currentState);

  const load = useCallback(async () => {
    try {
      const pending = await getProposedTransactions();
      setProposals(
        pending.filter(
          (proposal) =>
            proposalPresentationForSource(proposal.sourceType) ===
            'quiet',
        ),
      );
    } catch (error) {
      console.warn('[ProposalSummary] failed to load queue', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const change = DeviceEventEmitter.addListener(
      PROPOSED_TRANSACTIONS_CHANGED,
      () => void load(),
    );
    const subscription = AppState.addEventListener(
      'change',
      (nextState) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextState === 'active'
        ) {
          deferredIds.current.clear();
          void load();
        }
        appState.current = nextState;
      },
    );
    return () => {
      change.remove();
      subscription.remove();
    };
  }, [load]);

  const current = useMemo(
    () =>
      proposals.find(
        (proposal) => !deferredIds.current.has(proposal.id),
      ),
    [proposals],
  );
  const [duplicateOf, setDuplicateOf] = useState<string | null>(null);
  useEffect(() => {
    if (!current) return;
    let live = true;
    void findProposalDuplicate(current.id, current).then((match) => {
      if (live) setDuplicateOf(match ? current.id : null);
    });
    return () => {
      live = false;
    };
  }, [current]);
  const suppressed = pathname.startsWith('/proposal');
  const visible = !isLoading && !!current && !suppressed;

  const defer = useCallback(() => {
    if (!current) return;
    deferredIds.current.add(current.id);
    setProposals((existing) => [...existing]);
  }, [current]);

  const review = useCallback(() => {
    if (!current) return;
    router.push({
      pathname: '/proposal/[id]',
      params: { id: current.id },
    } as never);
  }, [current]);

  if (!visible || !current) return null;

  const copy = quietReviewCopy(proposals.length);
  const title =
    current.merchant ?? current.description ?? 'Transaction';
  const direction =
    current.type === 'income'
      ? 'Income'
      : current.type === 'transfer'
        ? 'Transfer'
        : 'Expense';
  const amountColor =
    current.type === 'income'
      ? tokens.income
      : current.type === 'transfer'
        ? tokens.transfer
        : tokens.expense;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={defer}
    >
      <View className="flex-1 justify-end bg-foreground/15">
        <Pressable
          testID={tid('review', 'review-this-later')}
          className="flex-1"
          onPress={defer}
          accessibilityRole="button"
          accessibilityLabel="Review this later"
        />
        <View className="bg-card relative min-h-[400px] rounded-[28px] px-6 pb-24 pt-4">
          <View className="mb-5 h-1.5 w-10 self-center rounded-full bg-border" />
          <View className="flex-row items-start gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-muted">
              <MaterialDesignIcons
                name="bell-outline"
                size={22}
                color={tokens.primary}
              />
            </View>
            <View className="flex-1">
              <Text className="text-base font-display-bold text-foreground">
                Review a notification capture
              </Text>
            </View>
          </View>

          <Pressable
            testID={tid('review', 'review')}
            onPress={review}
            className="mt-5"
            accessibilityRole="button"
            accessibilityLabel={`Review ${title}`}
          >
            <View className="rounded-card bg-sand flex-row items-start justify-between gap-3 px-4 py-4">
              <View className="min-w-0 flex-1">
                <Text className="text-xs font-display-semibold uppercase tracking-wide text-muted">
                  {direction} from{' '}
                  {current.sourceApp ?? 'notification'}
                </Text>
                <Text
                  className="mt-1 text-base font-display-bold text-foreground"
                  numberOfLines={1}
                >
                  {title}
                </Text>
              </View>
              <View className="items-end">
                <Text
                  className="text-lg font-display-bold"
                  style={{ color: amountColor }}
                >
                  {current.amountMinor == null
                    ? '—'
                    : minorToDecimal(current.amountMinor)}
                </Text>
                <Text className="mt-0.5 text-xs font-display-semibold text-muted">
                  {current.currency}
                </Text>
              </View>
            </View>
          </Pressable>

          {duplicateOf === current.id ? (
            <Text className="mt-3 text-center text-xs text-muted">
              Possible duplicate. Open details to merge.
            </Text>
          ) : null}
          <Text className="mt-3 text-center text-xs text-muted">
            {copy.queueLabel}
          </Text>
          <View className="mt-4">
            <Pressable
              testID={tid('review', 'defer')}
              onPress={defer}
              className="items-center justify-center rounded-2xl bg-surface-2 py-3.5"
              accessibilityRole="button"
            >
              <Text className="text-base font-display-semibold text-foreground">
                {copy.secondaryLabel}
              </Text>
            </Pressable>
          </View>
          <Button
            testID={tid('review', 'review')}
            className="absolute bottom-6 left-6 right-6"
            icon="check"
            label={copy.primaryLabel}
            onPress={review}
          />
        </View>
      </View>
    </Modal>
  );
}
