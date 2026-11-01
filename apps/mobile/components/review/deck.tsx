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
  type ReactNode,
} from 'react';
import { ActivityIndicator, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type EntryAnimationsValues,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AddedForYou } from '@/components/review/added-for-you';
import { CaughtUp, NothingToReview } from '@/components/review/caught-up';
import { EdgeCues } from '@/components/review/edge-cues';
import {
  HistoryToggle,
  RecentlyReviewed,
  historyCount,
  useRecentlyReviewed,
} from '@/components/review/recently-reviewed';
import {
  ReviewCard,
  type ReviewCardHandlers,
  type ReviewCardModel,
  type WalletLook,
} from '@/components/review/review-card';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { DuplicateMatch } from '@/lib/ai/duplicates';
import { timesFiled } from '@/lib/ai/routine';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate } from '@/lib/dates/day-label';
import { formatMoney, formatSignedMoney } from '@/lib/finance/format-money';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { merchantName } from '@/lib/finance/merchant-name';
import {
  budgetProgress$,
  categoriesForUser$,
  transactions$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import type { FinanceCategory, FinanceWallet } from '@/lib/finance/types';
import * as haptics from '@/lib/haptics';
import { springs } from '@/lib/motion/tokens';
import { budgetLine } from '@/lib/proposals/budget-line';
import { reviewStatus } from '@/lib/proposals/review-status';
import { canPairInto, undoPairing } from '@/lib/proposals/pairing';
import { captureSourceLabel, captureTime } from '@/lib/proposals/capture-source';
import {
  approve,
  duplicateOf,
  later,
  moveBackToReview,
  notATransfer,
  notMine,
  retypeEdits,
  reviewType,
  samePayment,
  undo,
  type ReviewEdits,
  type ReviewOutcome,
  type ReviewResult,
} from '@/lib/proposals/review-actions';
import {
  armedDecision,
  canDrag,
  DECISION_SIDE,
  idle,
  nextSelection,
  releasedSelection,
  releaseIntent,
  reviewCardReducer,
  selectionIntent,
  selectionReach,
  SWIPE_ENGAGE_SHARE,
  type EditField,
  type ReviewCardEvent,
  type ReviewCardState,
  type ReviewDecision,
  type SwipeIntent,
  type SwipeSelection,
  type SwipeSide,
} from '@/lib/proposals/review-card-state';
import { toCategoryTiles } from '@/lib/sheet/category-tiles';
import { openSheet, type WalletOption } from '@/lib/sheet/sheet-store';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';
import { listAwaitingReview, type RejectedProposal } from '@/lib/supabase/proposed-transactions';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import { getDefaultWalletId } from '@/lib/wallets/default-wallet';
import { compactWalletNames } from '@/lib/wallets/compact-name';
import { lastWalletForMerchant, resolveInitialWalletId } from '@/lib/wallets/proposal-wallet';

/** A Later row snoozed past any real date still counts as unreviewed. */
const END_OF_TIME = new Date(8.64e15);
const UNDER_SCALE = 0.96;
/** `XA-Review` tilts the card 12° per card width it travels. */
const TILT_PER_WIDTH_DEG = 12;
/** Room under the card for the Later cue. */
const LATER_ROOM = 56;
/** The board's 150 under its 480 card: the Later cue, then room for the toast above the buttons. */
const BELOW_CARD = 150;
/** Below this the card gives up the toast room before its content is cut. */
const CARD_MIN = 420;
const LIFT = '0 12px 32px rgba(23,24,26,0.18)';
/** A card this many of its own widths or heights away is off the screen. */
const OFFSTAGE_X = 1.6;
const OFFSTAGE_Y = 1.4;
const ARRIVE_FADE_MS = 180;

const noExit = () => ({ id: '', flown: false, done: false });

/** A restored card comes back along the path it left by, or fades in with no path to retrace. */
function arriveFrom(side: SwipeSide | null, width: number, height: number, reduceMotion: boolean) {
  const fromX = side === 'right' ? width * OFFSTAGE_X : side === 'left' ? -width * OFFSTAGE_X : 0;
  const fromY = side === 'down' ? height * OFFSTAGE_Y : 0;
  const tilt = `${Math.sign(fromX) * OFFSTAGE_X * TILT_PER_WIDTH_DEG}deg`;
  return (_values: EntryAnimationsValues) => {
    'worklet';
    if (!side || reduceMotion) {
      return {
        initialValues: { opacity: 0 },
        animations: {
          opacity: withTiming(1, { duration: ARRIVE_FADE_MS, reduceMotion: ReduceMotion.Never }),
        },
      };
    }
    return {
      initialValues: {
        transform: [{ translateX: fromX }, { translateY: fromY }, { rotate: tilt }],
      },
      animations: {
        transform: [
          { translateX: withSpring(0, springs.sheet) },
          { translateY: withSpring(0, springs.sheet) },
          { rotate: withSpring('0deg', springs.sheet) },
        ],
      },
    };
  };
}

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
 * The deck's cards and this session's results, for the All caught up sentence. The card for
 * `firstId` goes first; a capture that arrives while the page is open joins the back.
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

  const reopen = useCallback((proposal: ProposedTransaction) => {
    decided.current.delete(proposal.id);
    setResults((all) => all.filter((o) => o.proposal.id !== proposal.id));
    setQueue((current) => [proposal, ...current.filter((p) => p.id !== proposal.id)]);
  }, []);
  const restore = useCallback((outcome: ReviewOutcome) => reopen(outcome.proposal), [reopen]);

  /** The card flying out stays in the deck after its row leaves the store, until it is gone. */
  const setLeaving = useCallback((id: string | null) => {
    leaving.current = id;
  }, []);

  return { queue, results, setLeaving, decide, remove, restore, reopen };
}

export type ReviewSession = ReturnType<typeof useReviewSession>;

type Category = Omit<FinanceCategory, 'displayOrder'>;

type Lookups = {
  wallets: FinanceWallet[];
  categories: Category[];
  aliases: ReturnType<typeof listMerchantAliases>;
};

function walletLook(wallets: FinanceWallet[], id: string | null | undefined): WalletLook | null {
  const wallet = id ? wallets.find((w) => w.id === id) : undefined;
  return wallet
    ? {
        name: compactWalletNames(wallets)[wallet.id],
        fullName: wallet.name,
        icon: wallet.icon ?? 'wallet-outline',
        color: wallet.color,
      }
    : null;
}

function duplicateText(match: DuplicateMatch, currency: string): string {
  if (match.kind === 'transfer_pair') return 'Looks like money moving between two of your wallets.';
  const { target } = match;
  const amount = formatMoney((target.amountMinor ?? 0) as MinorAmount, target.currency || currency);
  return `You may already have this: ${target.merchant ?? 'a payment'} ${amount} on ${formatDate(target.at)}.`;
}

/** The other capture this card already counts, as the evidence line says it. */
function countedOnceText(proposal: ProposedTransaction): string | null {
  const absorbed = proposal.pairing?.absorbed;
  if (!absorbed) return null;
  const label = captureSourceLabel(absorbed);
  const quote = absorbed.notificationBody ?? absorbed.sourceText;
  const from = absorbed.sourceType === 'notification' ? `the ${label}` : label;
  return quote ? `Counted once with ${from}: “${quote}”` : `Counted once with ${from}.`;
}

function pairControl(
  proposal: ProposedTransaction,
  duplicate: DuplicateMatch | null,
): ReviewCardModel['pair'] {
  if (proposal.pairing) {
    return { kind: 'not-same-payment', label: 'Not the same payment', hint: null };
  }
  if (duplicate && canPairInto(duplicate)) {
    return pairOffer(duplicate);
  }
  if (proposal.type === 'transfer' && proposal.sourceType === 'notification') {
    return proposal.walletId
      ? { kind: 'not-a-transfer', label: "It's spending", hint: 'Approve keeps it a transfer.' }
      : { kind: 'not-a-transfer', label: "It's income", hint: 'Approve keeps it a transfer.' };
  }
  return null;
}

function pairOffer(duplicate: DuplicateMatch): NonNullable<ReviewCardModel['pair']> {
  return duplicate.kind === 'transfer_pair'
    ? { kind: 'its-a-transfer', label: "It's a transfer", hint: 'Approve keeps both.' }
    : { kind: 'same-payment', label: 'Same payment', hint: 'Approve keeps both.' };
}

function displayName(proposal: ProposedTransaction, edits: ReviewEdits, lookups: Lookups) {
  if (edits.merchant !== undefined) return edits.merchant;
  return (
    merchantName(proposal.merchant, lookups.aliases) ??
    proposal.description ??
    (reviewType(proposal, edits) === 'transfer' ? 'Transfer' : 'Capture')
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
  accessibilityLabel,
  icon,
  armed,
  busy,
  disabled,
  tone,
  onPress,
}: {
  decision: ReviewDecision;
  label: string;
  accessibilityLabel: string;
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
      accessibilityLabel={accessibilityLabel}
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
  arrive,
  width,
  height,
  children,
}: {
  x: SharedValue<number>;
  y: SharedValue<number>;
  /** 1 while a restored card is on its way home, so the card below settles as it lands. */
  arrive: SharedValue<number>;
  width: number;
  height: number;
  /** The face of the card a restored card is covering. Otherwise the under-card is blank (D7). */
  children?: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const reach = Math.min(
      1,
      Math.max(
        arrive.get(),
        Math.abs(x.get()) / (width * SWIPE_ENGAGE_SHARE),
        Math.max(0, y.get()) / (height * SWIPE_ENGAGE_SHARE),
      ),
    );
    return { transform: [{ scale: UNDER_SCALE + (1 - UNDER_SCALE) * reach }] };
  });
  return (
    <Animated.View
      testID={tid('review', 'next-card')}
      className="absolute inset-0 rounded-card bg-sand-light"
      style={[{ transformOrigin: '50% 90%' }, style]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * While the finger holds the card: the drag shadow under it, and a ring in the colour of the
 * way it is headed that firms to 4 once the decision is armed (`XA-Review`).
 */
function useCardLift(
  x: SharedValue<number>,
  y: SharedValue<number>,
  selection: SharedValue<SwipeSelection>,
  held: SharedValue<boolean>,
  size: { width: number; height: number; canApprove: boolean },
) {
  const { width, height, canApprove } = size;
  const tokens = useThemeTokens();
  const approveRing = canApprove ? tokens.mint : tokens.lemon;
  const notMineRing = tokens.primary;
  const laterRing = tokens.lemon;
  const shadow = useAnimatedStyle(() => ({ opacity: held.get() ? 1 : 0 }));
  const ring = useAnimatedStyle(() => {
    const current = selection.get();
    const reach = selectionReach(current, { dx: x.get(), dy: y.get(), width, height });
    const now = selectionIntent(current, canApprove);
    const armed = now === 'approve' || now === 'notMine' || now === 'later';
    const toward =
      current?.side === 'right' ? approveRing : current?.side === 'left' ? notMineRing : laterRing;
    const moving = held.get() && reach > 0;
    return {
      borderColor: toward,
      borderWidth: armed ? 4 : 3,
      opacity: moving ? (armed ? 1 : reach) : 0,
    };
  });
  return {
    shadow: (
      <Animated.View
        pointerEvents="none"
        className="absolute inset-0 rounded-card"
        style={[{ boxShadow: LIFT }, shadow]}
      />
    ),
    ring: (
      <Animated.View
        pointerEvents="none"
        className="absolute inset-0 rounded-card"
        style={ring}
      />
    ),
  };
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
    y.set(withSpring(height * OFFSTAGE_Y, { ...clamp, velocity: vy }, done));
    return;
  }
  const edge = width * OFFSTAGE_X;
  x.set(withSpring(decision === 'approve' ? edge : -edge, { ...clamp, velocity: vx }, done));
  y.set(withSpring(y.get() + vy * 0.12, { ...clamp, velocity: vy }));
}

export function ReviewDeck({ session }: { session: ReviewSession }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const mainCurrency = useMainCurrency();
  const wallets = useValue(walletsForUser$(userId));
  const categories = useValue(categoriesForUser$(userId));
  const ledger = useValue(transactions$({ userId }));
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

  const { queue, results, setLeaving, decide, remove, restore, reopen } = session;
  const history = useRecentlyReviewed();
  const [historyOpen, setHistoryOpen] = useState(false);
  const moveBack = useCallback(
    (proposal: RejectedProposal) => {
      moveBackToReview(proposal);
      const reopened = listAwaitingReview(END_OF_TIME).find((p) => p.id === proposal.id);
      if (reopened) reopen(reopened);
      setHistoryOpen(false);
      showToast({ text: 'Moved back to review' });
    },
    [reopen],
  );
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
  const selection = useSharedValue<SwipeSelection>(null);
  const held = useSharedValue(false);
  const arrive = useSharedValue(0);
  const exit = useRef(noExit());
  const reduceMotion = useReducedMotion();
  const [arrival, setArrival] = useState<{
    id: string;
    side: SwipeSide | null;
    overId: string | undefined;
  } | null>(null);

  const shownId = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    if (shownId.current === top?.id) return;
    shownId.current = top?.id;
    x.set(0);
    y.set(0);
    selection.set(null);
    cardRef.current = idle;
    setCard(idle);
  }, [top?.id, x, y, selection]);

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
  const room = area.height - 8;
  const cardHeight = Math.max(0, Math.min(room - LATER_ROOM, CARD_MIN), room - BELOW_CARD);
  const lift = useCardLift(x, y, selection, held, {
    width: cardWidth,
    height: cardHeight,
    canApprove,
  });

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
        title: destination
          ? 'Moves to'
          : !current
            ? 'Which wallet?'
            : reviewType(top, edits[top.id] ?? {}) === 'income'
              ? 'Paid into'
              : 'Paid from',
        wallets: destination ? mainWallets.filter((w) => w.id !== current) : mainWallets,
        selectedId: destination
          ? (edits[top.id]?.transferToWalletId ?? top.transferToWalletId)
          : current,
        suggestedId:
          destination || current
            ? null
            : lastWalletForMerchant(
                top.merchant,
                ledger,
                new Set(mainWallets.map((w) => w.id)),
              ),
      });
      if (picked?.walletId) {
        setEdit(top.id, destination ? { transferToWalletId: picked.walletId } : { walletId: picked.walletId });
      }
      send({ type: 'resolved' });
    },
    [top, edits, wallets, mainWallets, ledger, setEdit, send],
  );

  const pickCategory = useCallback(async () => {
    if (!top) return;
    const kind = reviewType(top, edits[top.id] ?? {}) === 'income' ? 'income' : 'expense';
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

  const pickType = useCallback(async () => {
    if (!top) return;
    const current = reviewType(top, edits[top.id] ?? {});
    const picked = await openSheet({ kind: 'transactionType', selected: current });
    if (picked && picked !== current) setEdit(top.id, retypeEdits(top, picked));
  }, [top, edits, setEdit]);

  const finishExit = useCallback(
    (part: 'flown' | 'done') => {
      const state = exit.current;
      state[part] = true;
      if (state.flown && state.done) {
        exit.current = noExit();
        remove(state.id);
      }
    },
    [remove],
  );
  const onFlown = useCallback(() => finishExit('flown'), [finishExit]);

  const snapBack = useCallback(() => {
    selection.set(null);
    x.set(withSpring(0, springs.throw));
    y.set(withSpring(0, springs.throw));
  }, [x, y, selection]);

  const endArrival = useCallback(() => setArrival(null), []);

  const bringBack = useCallback(
    (outcome: ReviewOutcome) => {
      const { id } = outcome.proposal;
      const flying = exit.current.id;
      if (flying === id) {
        // Undo beat the fly-out: the card is still on top, so turn it around where it is.
        exit.current = noExit();
        setLeaving(null);
        selection.set(null);
        x.set(withSpring(0, springs.sheet));
        y.set(withSpring(0, springs.sheet));
      } else {
        // The restored card takes over x and y, so a card still flying never reports landing.
        if (flying) finishExit('flown');
        const side = outcome.action === 'pair' ? null : DECISION_SIDE[outcome.action];
        setArrival({ id, side, overId: flying ? undefined : shownId.current });
        const landed = (finished?: boolean) => {
          'worklet';
          if (finished) scheduleOnRN(endArrival);
        };
        arrive.set(1);
        arrive.set(
          side && !reduceMotion
            ? withSpring(0, springs.sheet, landed)
            : withDelay(
                ARRIVE_FADE_MS,
                withTiming(0, { duration: 0, reduceMotion: ReduceMotion.Never }, landed),
                ReduceMotion.Never,
              ),
        );
      }
      restore(outcome);
    },
    [x, y, selection, arrive, reduceMotion, setLeaving, finishExit, endArrival, restore],
  );

  const toast = useCallback(
    (outcome: ReviewOutcome) => {
      const undoIt = () => {
        void undo(outcome).then(() => bringBack(outcome));
      };
      if (outcome.action === 'pair') {
        showToast({ text: 'Counted once', icon: 'link-variant', undo: undoIt });
      } else if (outcome.action === 'approve') {
        const name = displayName(outcome.proposal, {}, lookups);
        const amount = formatSignedMoney(
          outcome.proposal.type === 'income' ? 'income' : outcome.proposal.type === 'transfer' ? 'transfer' : 'expense',
          outcome.proposal.amountMinor ?? 0,
          outcome.proposal.currency,
        );
        showToast({ text: `Approved ${name} ${amount}`, undo: undoIt });
      } else if (outcome.action === 'notMine') {
        showToast({ text: '1 not mine', icon: 'close', undo: undoIt });
      } else {
        showToast({ text: 'Saved for later', icon: 'clock-outline', undo: undoIt });
      }
    },
    [lookups, bringBack],
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
      exit.current = noExit();
      setLeaving(null);
      snapBack();
      if (result.status === 'needsInput') void pickWallet(result.field);
    },
    [top, edits, wallets, setLeaving, send, decide, toast, finishExit, snapBack, pickWallet],
  );

  const pair = useCallback(async () => {
    if (!top || !canDrag(cardRef.current)) return;
    const proposal = top;
    if (!proposal.pairing && !duplicates[proposal.id] && proposal.type === 'transfer') {
      notATransfer(proposal);
      return;
    }
    if (proposal.pairing) {
      await undoPairing(proposal.pairing.absorbed.id);
      showToast({ text: 'Back in Review as its own capture' });
      return;
    }
    const match = duplicates[proposal.id];
    if (!match) return;
    haptics.approve();
    const result = await samePayment(proposal, edits[proposal.id] ?? {}, match);
    if (result.status === 'done') {
      decide(result.outcome);
      toast(result.outcome);
      remove(proposal.id);
    } else if (result.status === 'error') {
      showToast({ text: result.message, tone: 'removed' });
    }
  }, [top, duplicates, edits, decide, toast, remove]);

  const onIntent = useCallback(
    (next: SwipeIntent) => {
      const before = armedDecision(cardRef.current);
      const after = armedDecision(send({ type: 'drag', intent: next }));
      if (after && after !== before) haptics.thresholdOn();
      else if (!after && before) haptics.thresholdOff();
    },
    [send],
  );

  const onRelease = useCallback(
    (final: SwipeIntent) => {
      const next = send({ type: 'release', intent: final });
      if (next.kind === 'saving') void run(next.decision);
      else if (next.kind === 'needsInput') void pickWallet(next.field);
    },
    [send, run, pickWallet],
  );

  const press = useCallback(
    (decision: ReviewDecision) => {
      // A second tap while the card is still flying would decide it twice.
      if (exit.current.id === top?.id) return;
      const next = send({ type: 'press', decision, canApprove });
      if (next.kind === 'saving') {
        selection.set(releasedSelection(null, decision));
        flyOut(decision, x, y, cardWidth, cardHeight, 0, 0, onFlown);
        void run(decision);
      } else if (next.kind === 'needsInput') {
        void pickWallet(next.field);
      }
    },
    [top?.id, send, canApprove, selection, x, y, cardWidth, cardHeight, onFlown, run, pickWallet],
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
          selection.set(null);
          held.set(true);
        })
        .onUpdate((e) => {
          const rawX = startX.get() + e.translationX;
          const rawY = startY.get() + e.translationY;
          x.set(rawX > 0 && !canApprove ? rubberband(rawX, cardWidth) : rawX);
          y.set(rawY < 0 ? rubberband(rawY, cardHeight) : rawY);
          const before = selection.get();
          // The finger's travel, not the card's: the rubber band would put Pick wallet out of reach.
          const after = nextSelection(before, {
            dx: rawX,
            dy: rawY,
            width: cardWidth,
            height: cardHeight,
          });
          if (after === before) return;
          selection.set(after);
          const now = selectionIntent(after, canApprove);
          if (now !== selectionIntent(before, canApprove)) scheduleOnRN(onIntent, now);
        })
        .onEnd((e) => {
          const current = selection.get();
          const final = releaseIntent(current, {
            dx: startX.get() + e.translationX,
            dy: startY.get() + e.translationY,
            vx: e.velocityX,
            vy: e.velocityY,
            width: cardWidth,
            height: cardHeight,
            canApprove,
          });
          selection.set(releasedSelection(current, final));
          if (final === 'approve' || final === 'notMine' || final === 'later') {
            flyOut(final, x, y, cardWidth, cardHeight, e.velocityX, e.velocityY, onFlown);
          } else {
            x.set(withSpring(0, { ...springs.throw, velocity: e.velocityX }));
            y.set(withSpring(0, { ...springs.throw, velocity: e.velocityY }));
          }
          scheduleOnRN(onRelease, final);
        })
        .onFinalize(() => {
          held.set(false);
        }),
    [dragEnabled, canApprove, cardWidth, cardHeight, x, y, startX, startY, selection, held, onIntent, onRelease, onFlown],
  );

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      {
        rotate: `${cardWidth ? (x.get() / cardWidth) * TILT_PER_WIDTH_DEG : 0}deg`,
      },
    ],
  }));

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setArea((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
  };

  const modelOf = useCallback(
    (proposal: ProposedTransaction): ReviewCardModel => {
      const own = edits[proposal.id] ?? {};
      const type = reviewType(proposal, own);
      const categoryId = own.categoryId !== undefined ? own.categoryId : proposal.categoryId;
      const category = categoryId ? categories.find((c) => c.id === categoryId) : undefined;
      const amountMinor = (own.amountMinor ?? proposal.amountMinor ?? 0) as MinorAmount;
      const duplicate = duplicates[proposal.id] ?? null;
      const walletId = walletIdOf(proposal, own, wallets);
      const destinationId =
        own.transferToWalletId !== undefined ? own.transferToWalletId : proposal.transferToWalletId;
      const budget =
        type === 'expense' && category
          ? budgetLine(
              category.name,
              progress.find((p) => p.categoryId === category.id && p.currency === proposal.currency),
              amountMinor,
              proposal.currency,
            )
          : null;
      return {
        proposal: proposal,
        type,
        sourceLabel: captureSourceLabel(proposal),
        time: captureTime(proposal.notificationReceivedAt ?? proposal.createdAt),
        status: reviewStatus({
          hasWallet: !!walletId,
          paired: !!proposal.pairing,
          maybeDuplicate: !!duplicate,
          timesFiled: timesFiled(
            { type, currency: proposal.currency, merchant: own.merchant ?? proposal.merchant },
            ledger,
          ),
        }),
        quote:
          proposal.sourceType === 'notification'
            ? proposal.notificationBody
            : proposal.sourceType === 'text'
              ? proposal.sourceText
              : null,
        merchant: displayName(proposal, own, lookups),
        amountMinor,
        category: category ? { name: category.name, icon: category.icon, color: category.color } : null,
        wallet: walletLook(wallets, walletId),
        destination: type === 'transfer' ? walletLook(wallets, destinationId) : undefined,
        evidence:
          countedOnceText(proposal) ??
          (duplicate ? duplicateText(duplicate, proposal.currency) : proposal.aiReasoning),
        pair: pairControl(proposal, duplicate),
        // A likely duplicate is not a reason to stop asking about the merchant.
        similar: proposal.sourceType === 'notification' && !own.type && !duplicate ? !!own.similar : null,
        budget,
      };
    },
    [edits, categories, duplicates, wallets, progress, lookups, ledger],
  );
  const model = useMemo(() => (top ? modelOf(top) : null), [top, modelOf]);
  const coveredId = arrival?.overId;
  const coveredModel = useMemo(() => {
    const covered = queue.find((p) => p.id === coveredId);
    return covered ? modelOf(covered) : null;
  }, [queue, coveredId, modelOf]);

  const editing = card.kind === 'editing' ? card.field : null;
  const handlers = useMemo<ReviewCardHandlers | null>(() => {
    if (!top) return null;
    return {
      onEdit: (field: EditField) => send({ type: 'edit', field }),
      onCancelEdit: () => send({ type: 'endEdit' }),
      onSaveMerchant: (merchant) => setEdit(top.id, { merchant }),
      onSaveAmount: (amountMinor) => setEdit(top.id, { amountMinor }),
      onPickType: () => void pickType(),
      onPickCategory: () => void pickCategory(),
      onPickWallet: () => void pickWallet('wallet'),
      onPickDestination: () => void pickWallet('destination'),
      onToggleSimilar: () => {
        const next = !edits[top.id]?.similar;
        if (next) haptics.toggleOn();
        else haptics.toggleOff();
        setEdit(top.id, { similar: next });
      },
      onPair: () => void pair(),
    };
  }, [top, edits, send, setEdit, pickType, pickCategory, pickWallet, pair]);

  if (!top) {
    const recentlyReviewed = (
      <RecentlyReviewed
        groups={history}
        onMoveBack={moveBack}
      />
    );
    const homeRow = (
      <View className="px-5 pb-3 pt-1">
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
    if (!results.length) {
      return (
        <View className="flex-1">
          <ScrollView contentContainerClassName="gap-section px-5 pb-8 pt-2">
            <NothingToReview onCaptureLog={() => router.push('/capture-log')} />
            <AddedForYou />
            {recentlyReviewed}
          </ScrollView>
          {homeRow}
        </View>
      );
    }
    const approved = results.filter((o) => o.action === 'approve');
    const notMineCount = results.filter((o) => o.action === 'notMine').length;
    const pairedCount = results.filter((o) => o.action === 'pair').length;
    const laterCount = results.length - approved.length - notMineCount - pairedCount;
    const added = approved
      .filter((o) => o.proposal.currency === mainCurrency && o.proposal.type === 'expense')
      .reduce((sum, o) => sum + Number(o.proposal.amountMinor ?? 0), 0);
    const month = new Date().toLocaleString('en-US', { month: 'long' });
    const counts = [
      `${approved.length} approved`,
      `${notMineCount} not mine`,
      ...(pairedCount ? [`${pairedCount} counted once`] : []),
      ...(laterCount ? [`${laterCount} for later`] : []),
    ].join(', ');
    const sentence = `${counts}. ${added > 0 ? `${formatMoney(added as MinorAmount, mainCurrency)} now counts in ${month}.` : `Nothing new in ${month}.`}`;
    return (
      <View className="flex-1">
        <ScrollView contentContainerClassName="gap-section px-5 pb-8 pt-2">
          <CaughtUp
            sentence={sentence}
            addedMinor={added}
            onCaptureLog={() => router.push('/capture-log')}
          />
          <AddedForYou />
          {recentlyReviewed}
        </ScrollView>
        {homeRow}
      </View>
    );
  }

  const reviewedCount = historyCount(history);
  if (historyOpen) {
    return (
      <ScrollView contentContainerClassName="gap-section px-5 pb-8 pt-2">
        <HistoryToggle
          count={reviewedCount}
          open
          onPress={() => setHistoryOpen(false)}
        />
        <RecentlyReviewed
          groups={history}
          onMoveBack={moveBack}
          heading={false}
        />
      </ScrollView>
    );
  }

  const topType = reviewType(top, topEdits);
  const approveLabel =
    canApprove && model
      ? `Approve ${formatSignedMoney(
          topType === 'income' || topType === 'transfer' ? topType : 'expense',
          model.amountMinor,
          top.currency,
        )}`
      : 'Pick a wallet first';
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
                  arrive={arrive}
                  width={cardWidth}
                  height={cardHeight}
                >
                  {coveredModel && handlers ? (
                    <View
                      pointerEvents="none"
                      className="absolute inset-0"
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    >
                      <ReviewCard
                        model={coveredModel}
                        editing={null}
                        handlers={handlers}
                      />
                    </View>
                  ) : null}
                </UnderCard>
              ) : null}
              {model && handlers ? (
                <GestureDetector gesture={pan}>
                  <Animated.View
                    key={top.id}
                    testID={tid('review', 'card')}
                    className="absolute inset-0"
                    style={[{ transformOrigin: '50% 90%' }, topStyle]}
                  >
                    <Animated.View
                      className="absolute inset-0"
                      style={{ transformOrigin: '50% 90%' }}
                      entering={
                        arrival?.id === top.id
                          ? arriveFrom(arrival.side, cardWidth, cardHeight, reduceMotion)
                          : undefined
                      }
                    >
                      {lift.shadow}
                      <ReviewCard
                        model={model}
                        editing={editing}
                        handlers={handlers}
                      />
                      {lift.ring}
                    </Animated.View>
                  </Animated.View>
                </GestureDetector>
              ) : null}
            </View>
            {editing ? null : (
              <EdgeCues
                x={x}
                y={y}
                selection={selection}
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
            accessibilityLabel="Not mine. Nothing gets added"
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
            accessibilityLabel="Later. Save it for later"
            icon="clock-outline"
            tone="sand"
            armed={armed === 'later'}
            busy={saving === 'later'}
            disabled={locked}
            onPress={() => press('later')}
          />
          <DeckButton
            decision="approve"
            label={canApprove ? 'Approve' : 'Pick wallet'}
            accessibilityLabel={approveLabel}
            icon={canApprove ? 'check' : 'wallet-outline'}
            tone={canApprove ? 'mint' : 'lemon'}
            armed={armed === 'approve'}
            busy={saving === 'approve'}
            disabled={locked}
            onPress={() => press('approve')}
          />
        </View>
        {reviewedCount ? (
          <HistoryToggle
            count={reviewedCount}
            open={false}
            onPress={() => setHistoryOpen(true)}
          />
        ) : null}
      </View>
    </GestureHandlerRootView>
  );
}
