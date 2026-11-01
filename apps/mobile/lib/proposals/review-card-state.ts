import { projectedPosition } from '@/lib/motion/tokens';
import type { ReviewField, ReviewResult } from '@/lib/proposals/review-actions';

export type ReviewDecision = 'approve' | 'notMine' | 'later';
export type EditField = 'merchant' | 'amount';

export type SwipeSide = 'right' | 'left' | 'down';

/** The way each decision sends the card, by swipe or screen reader action, and the way Undo brings it back. */
export const DECISION_SIDE = {
  approve: 'right',
  notMine: 'left',
  later: 'down',
} as const satisfies Record<ReviewDecision, SwipeSide>;

/** The finger's offset in px, against the card's own size. */
export type SwipeTravel = { dx: number; dy: number; width: number; height: number };

/** How far the finger can go each way, from where it came down to the screen's edge. */
export type SwipeRoom = Record<SwipeSide, number>;

/** Before any touch, and for a decision no finger made. */
export const OPEN_ROOM: SwipeRoom = { right: Infinity, left: Infinity, down: Infinity };

export function swipeRoom(
  start: { x: number; y: number },
  screen: { width: number; height: number },
): SwipeRoom {
  'worklet';
  return { right: screen.width - start.x, left: start.x, down: screen.height - start.y };
}

/** A frame of the drag. */
export type SwipeOffset = SwipeTravel & { room: SwipeRoom };

/** The travel at release, with the velocity in px/s. */
export type Swipe = SwipeTravel & {
  vx: number;
  vy: number;
  /** Approve needs a wallet; without one a right swipe asks for it instead. */
  canApprove: boolean;
};

/** The side the card leans to, and whether its option is engaged. Null while nothing leans. */
export type SwipeSelection = { side: SwipeSide; engaged: boolean } | null;

export type SwipeIntent = ReviewDecision | 'needsWallet' | null;

/** A resting finger wobbles a few px, so no side leans inside this and the cues hold still. */
export const SWIPE_LEAN_PX = 16;
/** Under the lean distance, so a finger resting on that edge can't turn a side on and off. */
export const SWIPE_UNLEAN_PX = 8;
/** Near a diagonal the axes sit within tremor of each other, so the other side must clearly lead. */
export const SWIPE_SWITCH_MARGIN_PX = 24;
/** The margin's share of the engage distance, so it can't outweigh a short engage. */
export const SWIPE_SWITCH_SHARE = 0.16;
/** Share of the card an option takes to engage, when the finger has the room to go that far. */
export const SWIPE_ENGAGE_SHARE = 0.45;
/** Share of the room left to the screen's edge, so a finger starting near that edge still gets there. */
export const SWIPE_ROOM_SHARE = 0.6;
/** A twitch beside the edge never engages. Under the 24 between card and edge, so it stays reachable. */
export const SWIPE_ENGAGE_FLOOR_PX = 20;
/** An engaged option holds down to this share of its engage distance: 35% of the card at full distance. */
export const SWIPE_RELEASE_RATIO = 7 / 9;
/** Wider than tremor: the narrowest the release band or the switch margin ever gets. */
export const SWIPE_MIN_BAND_PX = 12;
/** Px/s. Under Shuffle's 1100 so a thumb flick counts; the old projection committed near 270. */
export const FLING_MIN_SPEED = 800;
/** A fling still has to move the card, so a twitch during a tap never decides anything. */
export const FLING_MIN_TRAVEL_SHARE = 0.12;

function travelToward(side: SwipeSide, dx: number, dy: number): number {
  'worklet';
  return side === 'right' ? dx : side === 'left' ? -dx : dy;
}

/** The finger's travel that engages this side: 45% of the card, or 60% of the room when that is less. */
export function swipeEngageAt(side: SwipeSide, offset: SwipeOffset): number {
  'worklet';
  // A tall card must not ask for a longer drag down than sideways: the thumb travels the same.
  const size = side === 'down' ? Math.min(offset.height, offset.width) : offset.width;
  return Math.max(
    SWIPE_ENGAGE_FLOOR_PX,
    Math.min(size * SWIPE_ENGAGE_SHARE, offset.room[side] * SWIPE_ROOM_SHARE),
  );
}

/**
 * The option under the finger, one frame on from `current`. Distance alone decides: velocity
 * swings every frame and belongs to the release. Returns `current` itself when nothing changed.
 */
export function nextSelection(current: SwipeSelection, offset: SwipeOffset): SwipeSelection {
  'worklet';
  const { dx, dy } = offset;
  const sideways = Math.abs(dx) >= dy;
  const lead: SwipeSide = sideways ? (dx >= 0 ? 'right' : 'left') : 'down';
  const leadTravel = sideways ? Math.abs(dx) : dy;

  let side = lead;
  if (current) {
    const held = travelToward(current.side, dx, dy);
    const margin = Math.min(
      SWIPE_SWITCH_MARGIN_PX,
      Math.max(SWIPE_MIN_BAND_PX, swipeEngageAt(current.side, offset) * SWIPE_SWITCH_SHARE),
    );
    if (lead === current.side || leadTravel <= held + margin) {
      if (held < SWIPE_UNLEAN_PX) return null;
      side = current.side;
    }
  } else if (leadTravel < SWIPE_LEAN_PX) {
    return null;
  }

  const engageAt = swipeEngageAt(side, offset);
  const holding = current?.side === side && current.engaged;
  const line = holding
    ? Math.min(engageAt * SWIPE_RELEASE_RATIO, engageAt - SWIPE_MIN_BAND_PX)
    : engageAt;
  const engaged = travelToward(side, dx, dy) >= line;
  return current?.side === side && current.engaged === engaged ? current : { side, engaged };
}

/** How far the card is on its way to engaging, 0 to 1, for the cues and the ring to follow. */
export function selectionReach(selection: SwipeSelection, offset: SwipeOffset): number {
  'worklet';
  if (!selection) return 0;
  const reach =
    travelToward(selection.side, offset.dx, offset.dy) / swipeEngageAt(selection.side, offset);
  return Math.min(1, Math.max(0, reach));
}

function intentOfSide(side: SwipeSide, canApprove: boolean): SwipeIntent {
  'worklet';
  if (side === 'right') return canApprove ? 'approve' : 'needsWallet';
  return side === 'left' ? 'notMine' : 'later';
}

/** What the highlighted option does, which is exactly what the release commits. */
export function selectionIntent(selection: SwipeSelection, canApprove: boolean): SwipeIntent {
  'worklet';
  return selection?.engaged ? intentOfSide(selection.side, canApprove) : null;
}

/**
 * The engaged option commits unless a fling pulled against it. With nothing engaged, a fling
 * commits the way it is thrown, on the projected position x + 0.5·v, once it has moved the card.
 */
export function releaseIntent(selection: SwipeSelection, swipe: Swipe): SwipeIntent {
  'worklet';
  const { dx, dy, vx, vy, width, height, canApprove } = swipe;
  if (selection?.engaged) {
    const speedAway = travelToward(selection.side, vx, vy);
    return speedAway <= -FLING_MIN_SPEED ? null : intentOfSide(selection.side, canApprove);
  }
  const landX = projectedPosition(dx, vx);
  const landY = projectedPosition(dy, vy);
  const sideways = Math.abs(landX) >= Math.abs(landY);
  const side: SwipeSide = sideways ? (landX >= 0 ? 'right' : 'left') : 'down';
  const thrown =
    travelToward(side, vx, vy) >= FLING_MIN_SPEED &&
    travelToward(side, dx, dy) >= (side === 'down' ? Math.min(height, width) : width) * FLING_MIN_TRAVEL_SHARE;
  return thrown ? intentOfSide(side, canApprove) : null;
}

/** After the finger lifts: a committed side stays lit while the card flies, the others let go. */
export function releasedSelection(selection: SwipeSelection, intent: SwipeIntent): SwipeSelection {
  'worklet';
  if (intent === 'approve' || intent === 'notMine' || intent === 'later') {
    return { side: DECISION_SIDE[intent], engaged: true };
  }
  return selection ? { side: selection.side, engaged: false } : null;
}

/** A normal large card, the same whatever it holds. The deck clamps it to the room it has. */
export const CARD_HEIGHT = 560;

/** The parts a card may have that its height can't always hold. */
export type CardParts = { quote: boolean; evidence: boolean; pair: boolean; similar: boolean };

/** How much of those parts the card shows. The pair control always shows. */
export type CardFit = { quoteLines: number; evidenceLines: number; similar: boolean };

/** Fullest first. The quote gives way first, then the evidence, and the checkbox only after both. */
const CARD_FITS: CardFit[] = [
  { quoteLines: 3, evidenceLines: 2, similar: true },
  { quoteLines: 2, evidenceLines: 2, similar: true },
  { quoteLines: 1, evidenceLines: 2, similar: true },
  { quoteLines: 0, evidenceLines: 2, similar: true },
  { quoteLines: 0, evidenceLines: 1, similar: true },
  { quoteLines: 0, evidenceLines: 0, similar: true },
  { quoteLines: 0, evidenceLines: 0, similar: false },
];

/**
 * The card's column in px, with text at the phone's font scale: padding, source row, the merchant
 * field open over the amount (the tallest the middle gets), three 48 rows and their hairlines.
 */
function heightNeeded(parts: CardParts, fit: CardFit, fontScale: number): number {
  const gap = 12;
  const footerGap = 6;
  const padding = 36;
  const source = 38 * fontScale;
  const middle = 52 + 50 * fontScale;
  const rows = 3 * 48 + 2;
  const quote =
    parts.quote && fit.quoteLines > 0 ? gap + 16 + fit.quoteLines * 20 * fontScale : 0;
  const footer = [
    parts.evidence ? fit.evidenceLines * 18 * fontScale : 0,
    parts.pair ? 40 : 0,
    parts.similar && fit.similar ? 44 : 0,
  ].filter((part) => part > 0);
  const footerHeight = footer.length
    ? gap + footer.reduce((sum, part) => sum + part, 0) + (footer.length - 1) * footerGap
    : 0;
  return padding + source + gap + middle + gap + rows + quote + footerHeight;
}

/** The fullest version of the card that its height holds, so nothing is ever clipped. */
export function cardFit(parts: CardParts, height: number, fontScale: number): CardFit {
  return (
    CARD_FITS.find((fit) => heightNeeded(parts, fit, fontScale) <= height) ??
    CARD_FITS[CARD_FITS.length - 1]
  );
}

/** The `CG-Guide` Review card rows, one member each. */
export type ReviewCardState =
  | { kind: 'idle' }
  | { kind: 'dragging' }
  | { kind: 'armedApprove' }
  | { kind: 'armedNotMine' }
  | { kind: 'armedLater' }
  | { kind: 'editing'; field: EditField }
  | { kind: 'needsInput'; field: ReviewField }
  | { kind: 'saving'; decision: ReviewDecision }
  | { kind: 'error'; message: string };

export type ReviewCardEvent =
  | { type: 'drag'; intent: SwipeIntent }
  | { type: 'release'; intent: SwipeIntent }
  | { type: 'decide'; decision: ReviewDecision; canApprove: boolean }
  | { type: 'edit'; field: EditField }
  | { type: 'endEdit' }
  | { type: 'result'; result: ReviewResult }
  /** The missing field was picked, or the error was seen. */
  | { type: 'resolved' };

export const idle: ReviewCardState = { kind: 'idle' };

const ARMED = {
  approve: { kind: 'armedApprove' },
  notMine: { kind: 'armedNotMine' },
  later: { kind: 'armedLater' },
} as const satisfies Record<ReviewDecision, ReviewCardState>;

/** The pan is off while a field edits and while a decision saves. */
export function canDrag(state: ReviewCardState): boolean {
  return state.kind !== 'editing' && state.kind !== 'saving';
}

export function armedDecision(state: ReviewCardState): ReviewDecision | null {
  switch (state.kind) {
    case 'armedApprove':
      return 'approve';
    case 'armedNotMine':
      return 'notMine';
    case 'armedLater':
      return 'later';
    default:
      return null;
  }
}

function decide(decision: ReviewDecision, canApprove: boolean): ReviewCardState {
  if (decision === 'approve' && !canApprove) return { kind: 'needsInput', field: 'wallet' };
  return { kind: 'saving', decision };
}

export function reviewCardReducer(
  state: ReviewCardState,
  event: ReviewCardEvent,
): ReviewCardState {
  switch (event.type) {
    case 'drag': {
      if (!canDrag(state)) return state;
      const { intent } = event;
      return intent === null || intent === 'needsWallet' ? { kind: 'dragging' } : ARMED[intent];
    }
    case 'release': {
      if (!canDrag(state)) return state;
      const { intent } = event;
      if (intent === null) return idle;
      if (intent === 'needsWallet') return { kind: 'needsInput', field: 'wallet' };
      return { kind: 'saving', decision: intent };
    }
    case 'decide':
      return canDrag(state) ? decide(event.decision, event.canApprove) : state;
    case 'edit':
      return state.kind === 'saving' ? state : { kind: 'editing', field: event.field };
    case 'endEdit':
      return state.kind === 'editing' ? idle : state;
    case 'result': {
      if (state.kind !== 'saving') return state;
      const { result } = event;
      if (result.status === 'done') return idle;
      if (result.status === 'needsInput') return { kind: 'needsInput', field: result.field };
      return { kind: 'error', message: result.message };
    }
    case 'resolved':
      return state.kind === 'needsInput' || state.kind === 'error' ? idle : state;
  }
}
