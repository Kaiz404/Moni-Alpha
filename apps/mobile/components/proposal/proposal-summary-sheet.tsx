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
  Text,
  View,
} from 'react-native';
import { usePathname, router } from 'expo-router';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import {
  minorToDecimal,
  type ProposedTransaction,
} from '@repo/types';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { Surface } from '@/components/ui/surface';
import { PROPOSED_TRANSACTIONS_CHANGED } from '@/lib/proposals/proposed-transactions-events';
import {
  proposalPresentationForSource,
  quietReviewCopy,
} from '@/lib/proposals/presentation-policy';
import { getProposedTransactions } from '@/lib/supabase/proposed-transactions';

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
          className="flex-1"
          onPress={defer}
          accessibilityRole="button"
          accessibilityLabel="Review this later"
        />
        <Surface
          smoothing="hero"
          className="rounded-[28px] px-6 pb-8 pt-4"
        >
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
              <Text className="text-base font-bold text-foreground">
                Review a notification capture
              </Text>
              <Text className="mt-1 text-sm leading-5 text-muted">
                Moni found a possible transaction. Nothing is saved
                until you approve it.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={review}
            className="mt-5"
            accessibilityRole="button"
            accessibilityLabel={`Review ${title}`}
          >
            <Surface
              tone="muted"
              className="flex-row items-start justify-between gap-3 px-4 py-4"
            >
              <View className="min-w-0 flex-1">
                <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {direction} from{' '}
                  {current.sourceApp ?? 'notification'}
                </Text>
                <Text
                  className="mt-1 text-base font-bold text-foreground"
                  numberOfLines={1}
                >
                  {title}
                </Text>
              </View>
              <View className="items-end">
                <Text
                  className="text-lg font-bold"
                  style={{ color: amountColor }}
                >
                  {current.amountMinor == null
                    ? '—'
                    : minorToDecimal(current.amountMinor)}
                </Text>
                <Text className="mt-0.5 text-xs font-semibold text-muted">
                  {current.currency}
                </Text>
              </View>
            </Surface>
          </Pressable>

          <Text className="mt-3 text-center text-xs text-muted">
            {copy.queueLabel}
          </Text>
          <View className="mt-4 flex-row gap-3">
            <Pressable
              onPress={defer}
              className="flex-1 items-center justify-center rounded-2xl bg-surface-2 py-3.5"
              accessibilityRole="button"
            >
              <Text className="text-base font-semibold text-foreground">
                {copy.secondaryLabel}
              </Text>
            </Pressable>
            <Pressable
              onPress={review}
              className="flex-1 items-center justify-center rounded-2xl bg-primary py-3.5"
              accessibilityRole="button"
            >
              <Text className="text-base font-semibold text-primary-foreground">
                {copy.primaryLabel}
              </Text>
            </Pressable>
          </View>
        </Surface>
      </View>
    </Modal>
  );
}
