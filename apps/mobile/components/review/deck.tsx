import { useSelector, useValue } from '@legendapp/state/react';
import type { MinorAmount, ProposedTransaction } from '@repo/types';
import { router } from 'expo-router';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { CaughtUp, NothingToReview, type SessionRow } from '@/components/review/caught-up';
import { EdgeCues } from '@/components/review/edge-cues';
import { budgetLine } from '@/components/review/result-pill';
import {
  ReviewCard,
  type ChipLook,
  type ReviewCardHandlers,
  type ReviewCardModel,
} from '@/components/review/review-card';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { DuplicateMatch } from '@/lib/ai/duplicates';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate } from '@/lib/dates/day-label';
import { formatMoney, formatSignedMoney } from '@/lib/finance/format-money';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { merchantName } from '@/lib/finance/merchant-name';
import {
  budgetProgress$,
  categoriesForUser$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import type { FinanceCategory, FinanceWallet } from '@/lib/finance/types';
import * as haptics from '@/lib/haptics';
import { parseAmountInput } from '@/lib/finance/money';
import { springs } from '@/lib/motion/tokens';
import { captureSourceLabel, captureTime } from '@/lib/proposals/capture-source';
import {
  approve,
  duplicateOf,
  later,
  notMine,
  undo,
  type ReviewEdits,
  type ReviewOutcome,
  type ReviewResult,
} from '@/lib/proposals/review-actions';
import {
  armedDecision,
  canDrag,
  idle,
  reviewCardReducer,
  swipeIntent,
  type EditField,
  type ReviewCardEvent,
  type ReviewCardState,
  type ReviewDecision,
  type Swipe,
  type SwipeIntent,
} from '@/lib/proposals/review-card-state';
import { toCategoryTiles } from '@/lib/sheet/category-tiles';
import { openSheet, type WalletOption } from '@/lib/sheet/sheet-store';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';
import { listAwaitingReview } from '@/lib/supabase/proposed-transactions';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import { resolveTransactionIcon } from '@/lib/transactions/icon';
import { getDefaultWalletId } from '@/lib/wallets/default-wallet';
import { resolveInitialWalletId } from '@/lib/wallets/proposal-wallet';

/** A Later row snoozed past any real date still counts as unreviewed. */
const END_OF_TIME = new Date(8.64e15);
const UNDER_SCALE = 0.96;
const MAX_TILT_DEG = 8;
/** Room under the card for the Later cue. */
const LATER_ROOM = 56;

function rubberband(overshoot: number, dimension: number): number {
  'worklet';
  const c = 0.55;
  return (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
}

function reconcile(
  queue: ProposedTransaction[],
  live: ProposedTransaction[],
  decided: ReadonlySet<string>,
  leaving: string | null,
): ProposedTransaction[] {
  const byId = new Map(live.map((p) => [p.id, p]));
  const kept = queue
    .filter((p) => byId.has(p.id) || p.id === leaving)
    .map((p) => {
      const now = byId.get(p.id);
      return now && now.updatedAt !== p.updatedAt ? now : p;
    });
  const keptIds = new Set(kept.map((p) => p.id));
  const next = [...kept, ...live.filter((p) => !keptIds.has(p.id) && !decided.has(p.id))];
  // The selector builds new objects on every render; an unchanged deck keeps its array.
  return next.length === queue.length && next.every((p, i) => p === queue[i]) ? queue : next;
}

/**
 * The deck's cards and this session's results (D6: memory only). The card for `firstId`
 * goes first; a capture that arrives while the page is open joins the back.
 */
export function useReviewSession(firstId: string | undefined) {
  const live = useSelector(() => {
    const list = listAwaitingReview(new Date());
    const first = firstId
      ? (list.find((p) => p.id === firstId) ??
        listAwaitingReview(END_OF_TIME).find((p) => p.id === firstId))
      : undefined;
    return first ? [first, ...list.filter((p) => p.id !== firstId)] : list;
  });
  const [queue, setQueue] = useState(live);
  const [results, setResults] = useState<ReviewOutcome[]>([]);
  const decided = useRef(new Set<string>());
  const leaving = useRef<string | null>(null);

  useEffect(() => {
    setQueue((current) => reconcile(current, live, decided.current, leaving.current));
  }, [live]);

  const decide = useCallback((outcome: ReviewOutcome) => {
    decided.current.add(outcome.proposal.id);
    setResults((all) => [...all, outcome]);
  }, []);

  const remove = useCallback((id: string) => {
    if (leaving.current === id) leaving.current = null;
    setQueue((current) => current.filter((p) => p.id !== id));
  }, []);

  const restore = useCallback((outcome: ReviewOutcome) => {
    const id = outcome.proposal.id;
    decided.current.delete(id);
    setResults((all) => all.filter((o) => o.proposal.id !== id));
    setQueue((current) => [outcome.proposal, ...current.filter((p) => p.id !== id)]);
  }, []);

  /** The card flying out stays in the deck after its row leaves the store, until it is gone. */
  const setLeaving = useCallback((id: string | null) => {
    leaving.current = id;
  }, []);

  return { queue, results, setLeaving, decide, remove, restore };
}

export type ReviewSession = ReturnType<typeof useReviewSession>;

type Category = Omit<FinanceCategory, 'displayOrder'>;

type Lookups = {
  wallets: FinanceWallet[];
  categories: Category[];
  aliases: ReturnType<typeof listMerchantAliases>;
};

function walletLook(wallets: FinanceWallet[], id: string | null | undefined): ChipLook | null {
  const wallet = id ? wallets.find((w) => w.id === id) : undefined;
  return wallet ? { name: wallet.name, icon: wallet.icon ?? 'wallet-outline', color: wallet.color } : null;
}

function duplicateText(match: DuplicateMatch, currency: string): string {
  if (match.kind === 'transfer_pair') return 'Looks like money moving between two of your wallets.';
  const { target } = match;
  const amount = formatMoney((target.amountMinor ?? 0) as MinorAmount, target.currency || currency);
  return `You may already have this: ${target.merchant ?? 'a payment'} ${amount} on ${formatDate(target.at)}.`;
}

function displayName(proposal: ProposedTransaction, edits: ReviewEdits, lookups: Lookups) {
  if (edits.merchant !== undefined) return edits.merchant;
  return (
    merchantName(proposal.merchant, lookups.aliases) ??
    proposal.description ??
    (proposal.type === 'transfer' ? 'Transfer' : 'Capture')
  );
}

function walletIdOf(proposal: ProposedTransaction, edits: ReviewEdits, wallets: FinanceWallet[]) {
  return edits.walletId !== undefined
    ? edits.walletId
    : resolveInitialWalletId(proposal, wallets, getDefaultWalletId());
}

function DeckButton({
  decision,
  label,
  icon,
  armed,
  busy,
  disabled,
  tone,
  onPress,
}: {
  decision: ReviewDecision;
  label: string;
  icon: IconSymbolName;
  armed: boolean;
  busy: boolean;
  disabled: boolean;
  tone: 'sand' | 'mint' | 'lemon';
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  const fill = { sand: 'bg-sand', mint: 'bg-mint', lemon: 'bg-lemon' }[tone];
  const pressed = { sand: 'bg-hairline', mint: 'bg-mint-pressed', lemon: 'bg-hairline' }[tone];
  const ink = tone === 'sand' ? tokens.foreground : tokens.onPastel;
  return (
    <Press
      testID={tid('review', decision === 'notMine' ? 'not-mine' : decision)}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      radius={{ rest: 26, pressed: 16 }}
      pressedClassName={pressed}
      className={`h-[52px] min-w-0 flex-1 flex-row items-center justify-center gap-1.5 px-1.5 ${fill} ${armed ? 'border-[3px] border-foreground' : ''}`}
    >
      {busy ? (
        <ActivityIndicator
          size={18}
          color={ink}
        />
      ) : (
        <IconSymbol
          name={icon}
          size={20}
          color={ink}
        />
      )}
      <Text
        className={`text-[15px] leading-[21px] font-display-semibold ${tone === 'sand' ? 'text-foreground' : 'text-on-pastel'}`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Press>
  );
}

function UnderCard({
  x,
  y,
  width,
  height,
}: {
  x: SharedValue<number>;
  y: SharedValue<number>;
  width: number;
  height: number;
}) {
  const style = useAnimatedStyle(() => {
    const reach = Math.min(
      1,
      Math.max(Math.abs(x.get()) / (width * 0.4), Math.max(0, y.get()) / (height * 0.4)),
    );
    return { transform: [{ scale: UNDER_SCALE + (1 - UNDER_SCALE) * reach }] };
  });
  return (
    <Animated.View
      testID={tid('review', 'next-card')}
      className="absolute inset-0 rounded-card bg-sand-light"
      style={style}
    />
  );
}

/** Flings the top card off toward its decision; the spring keeps the release velocity. */
function flyOut(
  decision: ReviewDecision,
  x: SharedValue<number>,
  y: SharedValue<number>,
  width: number,
  height: number,
  vx: number,
  vy: number,
  onFlown: () => void,
) {
  'worklet';
  const done = (finished?: boolean) => {
    'worklet';
    if (finished) scheduleOnRN(onFlown);
  };
  const clamp = { ...springs.sheet, overshootClamping: true };
  if (decision === 'later') {
    x.set(withSpring(0, { ...clamp, velocity: vx }));
    y.set(withSpring(height * 1.4, { ...clamp, velocity: vy }, done));
    return;
  }
  const edge = width * 1.6;
  x.set(withSpring(decision === 'approve' ? edge : -edge, { ...clamp, velocity: vx }, done));
  y.set(withSpring(y.get() + vy * 0.12, { ...clamp, velocity: vy }));
}

export function ReviewDeck({ session }: { session: ReviewSession }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const mainCurrency = useMainCurrency();
  const wallets = useValue(walletsForUser$(userId));
  const categories = useValue(categoriesForUser$(userId));
  const aliases = useSelector(() => (userId ? listMerchantAliases(userId) : []));
  const [timezone, setTimezone] = useState('UTC');
  const progress = useValue(budgetProgress$(userId, timezone));
  const lookups = useMemo<Lookups>(
    () => ({ wallets, categories, aliases }),
    [wallets, categories, aliases],
  );

  useEffect(() => {
    void ensureFinanceTimezone()
      .then(setTimezone)
      .catch(() => {});
  }, []);

  const { queue, results, setLeaving, decide, remove, restore } = session;
  const top = queue[0];
  const [edits, setEdits] = useState<Record<string, ReviewEdits>>({});
  const [duplicates, setDuplicates] = useState<Record<string, DuplicateMatch | null>>({});
  const [card, setCard] = useState<ReviewCardState>(idle);
  const cardRef = useRef(card);
  const [area, setArea] = useState({ width: 0, height: 0 });

  const send = useCallback((event: ReviewCardEvent) => {
    const next = reviewCardReducer(cardRef.current, event);
    cardRef.current = next;
    setCard(next);
    return next;
  }, []);

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const intent = useSharedValue<SwipeIntent>(null);
  const exit = useRef({ id: '', flown: false, done: false });

  const shownId = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    if (shownId.current === top?.id) return;
    shownId.current = top?.id;
    x.set(0);
    y.set(0);
    intent.set(null);
    cardRef.current = idle;
    setCard(idle);
  }, [top?.id, x, y, intent]);

  useEffect(() => {
    if (!top || top.id in duplicates) return;
    let live = true;
    void duplicateOf(top)
      .then((match) => live && setDuplicates((all) => ({ ...all, [top.id]: match })))
      .catch(() => live && setDuplicates((all) => ({ ...all, [top.id]: null })));
    return () => {
      live = false;
    };
  }, [top, duplicates]);

  const topEdits = top ? (edits[top.id] ?? {}) : {};
  const topWalletId = top ? walletIdOf(top, topEdits, wallets) : null;
  const canApprove = !!topWalletId;
  const cardWidth = Math.max(0, area.width - 48);
  const cardHeight = Math.max(0, area.height - 8 - LATER_ROOM);

  const setEdit = useCallback((id: string, patch: ReviewEdits) => {
    setEdits((all) => ({ ...all, [id]: { ...all[id], ...patch } }));
  }, []);

  const mainWallets = useMemo<WalletOption[]>(
    () =>
      wallets
        .filter((w) => w.isActive && w.currency === mainCurrency)
        .map((w) => ({
          id: w.id,
          name: w.name,
          currency: w.currency,
          type: w.type,
          icon: w.icon,
          color: w.color,
          cardStyleId: w.cardStyleId,
        })),
    [wallets, mainCurrency],
  );

  const pickWallet = useCallback(
    async (field: 'wallet' | 'destination') => {
      if (!top) return;
      const current = walletIdOf(top, edits[top.id] ?? {}, wallets);
      const destination = field === 'destination';
      const picked = await openSheet({
        kind: 'wallet',
        title: destination ? 'Moves to' : current ? 'Paid from' : 'Which wallet?',
        wallets: destination ? mainWallets.filter((w) => w.id !== current) : mainWallets,
        selectedId: destination
          ? (edits[top.id]?.transferToWalletId ?? top.transferToWalletId)
          : current,
      });
      if (picked?.walletId) {
        setEdit(top.id, destination ? { transferToWalletId: picked.walletId } : { walletId: picked.walletId });
      }
      send({ type: 'resolved' });
    },
    [top, edits, wallets, mainWallets, setEdit, send],
  );

  const pickCategory = useCallback(async () => {
    if (!top) return;
    const kind = top.type === 'income' ? 'income' : 'expense';
    const selected =
      edits[top.id]?.categoryId !== undefined ? edits[top.id]!.categoryId! : top.categoryId;
    const picked = await openSheet({
      kind: 'category',
      title: 'Choose category',
      currency: mainCurrency,
      categories: toCategoryTiles(
        categories.filter((c) => c.isActive && c.type === kind),
        progress,
        mainCurrency,
      ),
      selectedId: selected,
    });
    if (picked) setEdit(top.id, { categoryId: picked });
  }, [top, edits, categories, progress, mainCurrency, setEdit]);

  const finishExit = useCallback(
    (part: 'flown' | 'done') => {
      const state = exit.current;
      state[part] = true;
      if (state.flown && state.done) remove(state.id);
    },
    [remove],
  );
  const onFlown = useCallback(() => finishExit('flown'), [finishExit]);

  const snapBack = useCallback(() => {
    x.set(withSpring(0, springs.throw));
    y.set(withSpring(0, springs.throw));
  }, [x, y]);

  const toast = useCallback(
    (outcome: ReviewOutcome) => {
      const undoIt = () => {
        void undo(outcome).then(() => restore(outcome));
      };
      if (outcome.action === 'approve') {
        const name = displayName(outcome.proposal, {}, lookups);
        const amount = formatSignedMoney(
          outcome.proposal.type === 'income' ? 'income' : outcome.proposal.type === 'transfer' ? 'transfer' : 'expense',
          outcome.proposal.amountMinor ?? 0,
          outcome.proposal.currency,
        );
        showToast({ text: `Approved ${name} ${amount}`, undo: undoIt });
      } else if (outcome.action === 'notMine') {
        showToast({ text: '1 not mine', tone: 'removed', undo: undoIt });
      } else {
        showToast({ text: 'Saved for later' });
      }
    },
    [lookups, restore],
  );

  const run = useCallback(
    async (decision: ReviewDecision) => {
      if (!top) return;
      const proposal = top;
      exit.current = { id: proposal.id, flown: false, done: false };
      setLeaving(proposal.id);
      if (decision === 'approve') haptics.approve();
      if (decision === 'notMine') haptics.notMine();
      const own = edits[proposal.id] ?? {};
      let result: ReviewResult;
      if (decision === 'approve') {
        result = await approve(proposal, { ...own, walletId: walletIdOf(proposal, own, wallets) });
      } else if (decision === 'notMine') {
        result = await notMine(proposal);
      } else {
        result = await later(proposal);
      }
      send({ type: 'result', result });
      if (result.status === 'done') {
        decide(result.outcome);
        toast(result.outcome);
        finishExit('done');
        return;
      }
      setLeaving(null);
      snapBack();
      if (result.status === 'needsInput') void pickWallet(result.field);
    },
    [top, edits, wallets, setLeaving, send, decide, toast, finishExit, snapBack, pickWallet],
  );

  const onIntent = useCallback(
    (swipe: Swipe) => {
      const before = armedDecision(cardRef.current);
      const after = armedDecision(send({ type: 'drag', swipe }));
      if (after && after !== before) haptics.thresholdOn();
      else if (!after && before) haptics.thresholdOff();
    },
    [send],
  );

  const onRelease = useCallback(
    (swipe: Swipe) => {
      const next = send({ type: 'release', swipe });
      if (next.kind === 'saving') void run(next.decision);
      else if (next.kind === 'needsInput') void pickWallet(next.field);
    },
    [send, run, pickWallet],
  );

  const press = useCallback(
    (decision: ReviewDecision) => {
      const next = send({ type: 'press', decision, canApprove });
      if (next.kind === 'saving') {
        flyOut(decision, x, y, cardWidth, cardHeight, 0, 0, onFlown);
        void run(decision);
      } else if (next.kind === 'needsInput') {
        void pickWallet(next.field);
      }
    },
    [send, canApprove, x, y, cardWidth, cardHeight, onFlown, run, pickWallet],
  );

  const dragEnabled = !!top && canDrag(card) && cardWidth > 0;
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(dragEnabled)
        .minDistance(6)
        .onStart(() => {
          startX.set(x.get());
          startY.set(y.get());
        })
        .onUpdate((e) => {
          const rawX = startX.get() + e.translationX;
          const rawY = startY.get() + e.translationY;
          const dx = rawX > 0 && !canApprove ? rubberband(rawX, cardWidth) : rawX;
          const dy = rawY < 0 ? rubberband(rawY, cardHeight) : rawY;
          x.set(dx);
          y.set(dy);
          const swipe = {
            dx,
            dy,
            vx: e.velocityX,
            vy: e.velocityY,
            width: cardWidth,
            height: cardHeight,
            canApprove,
          };
          const next = swipeIntent(swipe);
          if (next !== intent.get()) {
            intent.set(next);
            scheduleOnRN(onIntent, swipe);
          }
        })
        .onEnd((e) => {
          const swipe = {
            dx: x.get(),
            dy: y.get(),
            vx: e.velocityX,
            vy: e.velocityY,
            width: cardWidth,
            height: cardHeight,
            canApprove,
          };
          const final = swipeIntent(swipe);
          intent.set(null);
          if (final === 'approve' || final === 'notMine' || final === 'later') {
            flyOut(final, x, y, cardWidth, cardHeight, e.velocityX, e.velocityY, onFlown);
          } else {
            x.set(withSpring(0, { ...springs.throw, velocity: e.velocityX }));
            y.set(withSpring(0, { ...springs.throw, velocity: e.velocityY }));
          }
          scheduleOnRN(onRelease, swipe);
        }),
    [dragEnabled, canApprove, cardWidth, cardHeight, x, y, startX, startY, intent, onIntent, onRelease, onFlown],
  );

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      {
        rotate: `${interpolate(x.get(), [-cardWidth, cardWidth], [-MAX_TILT_DEG, MAX_TILT_DEG], Extrapolation.CLAMP)}deg`,
      },
    ],
  }));

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setArea((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
  };

  const model = useMemo<ReviewCardModel | null>(() => {
    if (!top) return null;
    const own = edits[top.id] ?? {};
    const categoryId = own.categoryId !== undefined ? own.categoryId : top.categoryId;
    const category = categoryId ? categories.find((c) => c.id === categoryId) : undefined;
    const amountMinor = (own.amountMinor ?? top.amountMinor ?? 0) as MinorAmount;
    const duplicate = duplicates[top.id] ?? null;
    const walletId = walletIdOf(top, own, wallets);
    const destinationId =
      own.transferToWalletId !== undefined ? own.transferToWalletId : top.transferToWalletId;
    const budget =
      top.type === 'expense' && category
        ? budgetLine(
            category.name,
            progress.find((p) => p.categoryId === category.id && p.currency === top.currency),
            amountMinor,
            top.currency,
          )
        : null;
    return {
      proposal: top,
      sourceLabel: captureSourceLabel(top),
      time: captureTime(top.notificationReceivedAt ?? top.createdAt),
      status: !walletId
        ? { tone: 'near', label: 'Needs a wallet' }
        : duplicate
          ? { tone: 'review', label: 'Maybe a duplicate' }
          : null,
      quote:
        top.sourceType === 'notification'
          ? top.notificationBody
          : top.sourceType === 'text'
            ? top.sourceText
            : null,
      merchant: displayName(top, own, lookups),
      amountMinor,
      category: category ? { name: category.name, icon: category.icon, color: category.color } : null,
      wallet: walletLook(wallets, walletId),
      destination: top.type === 'transfer' ? walletLook(wallets, destinationId) : undefined,
      evidence: duplicate ? duplicateText(duplicate, top.currency) : top.aiReasoning,
      similar: top.sourceType === 'notification' ? !!own.similar : null,
      budget,
    };
  }, [top, edits, categories, duplicates, wallets, progress, lookups]);

  const editing = card.kind === 'editing' ? card.field : null;
  const handlers = useMemo<ReviewCardHandlers | null>(() => {
    if (!top) return null;
    const endEdit = () => send({ type: 'endEdit' });
    return {
      onEdit: (field: EditField) => send({ type: 'edit', field }),
      onCancelEdit: endEdit,
      onSaveMerchant: (value) => {
        if (!value.trim()) return;
        setEdit(top.id, { merchant: value.trim() });
        endEdit();
      },
      onSaveAmount: (value) => {
        try {
          setEdit(top.id, { amountMinor: parseAmountInput(value) });
          endEdit();
        } catch {
          // An amount that does not parse keeps the field open, as the board's save does.
        }
      },
      onPickCategory: () => void pickCategory(),
      onPickWallet: () => void pickWallet('wallet'),
      onPickDestination: () => void pickWallet('destination'),
      onToggleSimilar: () => {
        const next = !edits[top.id]?.similar;
        if (next) haptics.toggleOn();
        else haptics.toggleOff();
        setEdit(top.id, { similar: next });
      },
    };
  }, [top, edits, send, setEdit, pickCategory, pickWallet]);

  if (!top) {
    const decidedRows = results.filter((o) => o.action !== 'later');
    if (!results.length) {
      return (
        <View className="px-5 pt-2">
          <NothingToReview onCaptureLog={() => router.push('/notifications')} />
        </View>
      );
    }
    const approved = results.filter((o) => o.action === 'approve');
    const notMineCount = results.filter((o) => o.action === 'notMine').length;
    const laterCount = results.length - approved.length - notMineCount;
    const added = approved
      .filter((o) => o.proposal.currency === mainCurrency && o.proposal.type === 'expense')
      .reduce((sum, o) => sum + Number(o.proposal.amountMinor ?? 0), 0);
    const month = new Date().toLocaleString('en-US', { month: 'long' });
    const counts = [
      `${approved.length} approved`,
      `${notMineCount} not mine`,
      ...(laterCount ? [`${laterCount} for later`] : []),
    ].join(', ');
    const sentence = `${counts}. ${added > 0 ? `${formatMoney(added as MinorAmount, mainCurrency)} now counts in ${month}.` : `Nothing new in ${month}.`}`;
    const rows: SessionRow[] = decidedRows.map((o) => {
      const category = categories.find((c) => c.id === o.proposal.categoryId);
      const ok = o.action === 'approve';
      return {
        id: o.proposal.id,
        title: displayName(o.proposal, {}, lookups),
        meta: ok
          ? `${category?.name ?? 'No category'}${o.ruleAdded ? ' · Auto from now' : ''}`
          : 'Not mine',
        amountText: formatSignedMoney(
          o.proposal.type === 'income' ? 'income' : o.proposal.type === 'transfer' ? 'transfer' : 'expense',
          o.proposal.amountMinor ?? 0,
          o.proposal.currency,
        ),
        icon: ok ? resolveTransactionIcon(category?.icon, o.proposal.type ?? 'expense') : 'close',
        color: ok ? (category?.color ?? null) : null,
        struck: !ok,
      };
    });
    return (
      <View className="gap-3 px-5 pt-2">
        <CaughtUp
          sentence={sentence}
          rows={rows}
          onCaptureLog={() => router.push('/notifications')}
        />
        <Press
          testID={tid('review', 'home')}
          onPress={() => router.dismissTo('/')}
          accessibilityLabel="Back to Home"
          radius={{ rest: 26, pressed: 16 }}
          pressedClassName="bg-primary-pressed"
          className="h-[52px] items-center justify-center bg-primary"
        >
          <Text className="text-[15px] leading-[21px] font-display-semibold text-primary-foreground">
            Back to Home
          </Text>
        </Press>
      </View>
    );
  }

  const armed = armedDecision(card);
  const saving = card.kind === 'saving' ? card.decision : null;
  const locked = card.kind === 'saving' || card.kind === 'editing';

  return (
    <GestureHandlerRootView className="flex-1">
      <View
        testID={tid('review', 'deck')}
        className="flex-1"
        onLayout={onLayout}
      >
        {cardWidth > 0 ? (
          <>
            <View
              className="absolute"
              style={{ left: 24, top: 8, width: cardWidth, height: cardHeight }}
            >
              {queue.length > 1 ? (
                <UnderCard
                  x={x}
                  y={y}
                  width={cardWidth}
                  height={cardHeight}
                />
              ) : null}
              {model && handlers ? (
                <GestureDetector gesture={pan}>
                  <Animated.View
                    key={top.id}
                    testID={tid('review', 'card')}
                    className="absolute inset-0"
                    style={[{ transformOrigin: '50% 90%' }, topStyle]}
                  >
                    <ReviewCard
                      model={model}
                      editing={editing}
                      handlers={handlers}
                    />
                  </Animated.View>
                </GestureDetector>
              ) : null}
            </View>
            {editing ? null : (
              <EdgeCues
                x={x}
                y={y}
                intent={intent}
                width={cardWidth}
                height={cardHeight}
                cardTop={8}
                canApprove={canApprove}
              />
            )}
          </>
        ) : null}
      </View>
      <View className="gap-2 px-5 pb-3 pt-1">
        {card.kind === 'error' ? (
          <Text
            variant="meta"
            className="text-over"
            accessibilityLiveRegion="assertive"
            accessibilityRole="alert"
          >
            {card.message}
          </Text>
        ) : null}
        <View className="flex-row gap-2">
          <DeckButton
            decision="notMine"
            label="Not mine"
            icon="close"
            tone="sand"
            armed={armed === 'notMine'}
            busy={saving === 'notMine'}
            disabled={locked}
            onPress={() => press('notMine')}
          />
          <DeckButton
            decision="later"
            label="Later"
            icon="clock-outline"
            tone="sand"
            armed={armed === 'later'}
            busy={saving === 'later'}
            disabled={locked}
            onPress={() => press('later')}
          />
          <DeckButton
            decision="approve"
            label={canApprove ? 'Approve' : 'Pick a wallet'}
            icon={canApprove ? 'check' : 'wallet-outline'}
            tone={canApprove ? 'mint' : 'lemon'}
            armed={armed === 'approve'}
            busy={saving === 'approve'}
            disabled={locked}
            onPress={() => press('approve')}
          />
        </View>
      </View>
    </GestureHandlerRootView>
  );
}
