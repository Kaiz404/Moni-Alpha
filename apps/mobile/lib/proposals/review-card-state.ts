import { projectedPosition } from '@/lib/motion/tokens';
import type { ReviewField, ReviewResult } from '@/lib/proposals/review-actions';

export type ReviewDecision = 'approve' | 'notMine' | 'later';
export type EditField = 'merchant' | 'amount';

export type SwipeSide = 'right' | 'left' | 'down';

/** The way each decision sends the card, by swipe or by button, and the way Undo brings it back. */
export const DECISION_SIDE = {
  approve: 'right',
  notMine: 'left',
  later: 'down',
} as const satisfies Record<ReviewDecision, SwipeSide>;

/** The finger's offset in px, against the card's own size. */
export type SwipeOffset = { dx: number; dy: number; width: number; height: number };

/** The offset at release, with the velocity in px/s. */
export type Swipe = SwipeOffset & {
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
/** Share of the card an option takes to engage. Was 40% of a projection that velocity inflated. */
export const SWIPE_ENGAGE_SHARE = 0.45;
/** An engaged option holds down to here: a band of about 34 px on a phone, wider than tremor. */
export const SWIPE_RELEASE_SHARE = 0.35;
/** Px/s. Under Shuffle's 1100 so a thumb flick counts; the old projection committed near 270. */
export const FLING_MIN_SPEED = 800;
/** A fling still has to move the card, so a twitch during a tap never decides anything. */
export const FLING_MIN_TRAVEL_SHARE = 0.12;

function travelToward(side: SwipeSide, dx: number, dy: number): number {
  'worklet';
  return side === 'right' ? dx : side === 'left' ? -dx : dy;
}

/**
 * The option under the finger, one frame on from `current`. Distance alone decides: velocity
 * swings every frame and belongs to the release. Returns `current` itself when nothing changed.
 */
export function nextSelection(current: SwipeSelection, offset: SwipeOffset): SwipeSelection {
  'worklet';
  const { dx, dy, width, height } = offset;
  const sideways = Math.abs(dx) >= dy;
  const lead: SwipeSide = sideways ? (dx >= 0 ? 'right' : 'left') : 'down';
  const leadTravel = sideways ? Math.abs(dx) : dy;

  let side = lead;
  if (current) {
    const held = travelToward(current.side, dx, dy);
    if (lead === current.side || leadTravel <= held + SWIPE_SWITCH_MARGIN_PX) {
      if (held < SWIPE_UNLEAN_PX) return null;
      side = current.side;
    }
  } else if (leadTravel < SWIPE_LEAN_PX) {
    return null;
  }

  const size = side === 'down' ? height : width;
  const holding = current?.side === side && current.engaged;
  const share = holding ? SWIPE_RELEASE_SHARE : SWIPE_ENGAGE_SHARE;
  const engaged = travelToward(side, dx, dy) >= size * share;
  return current?.side === side && current.engaged === engaged ? current : { side, engaged };
}

/** How far the card is on its way to engaging, 0 to 1, for the cues and the ring to follow. */
export function selectionReach(selection: SwipeSelection, offset: SwipeOffset): number {
  'worklet';
  if (!selection) return 0;
  const { dx, dy, width, height } = offset;
  const size = selection.side === 'down' ? height : width;
  const reach = travelToward(selection.side, dx, dy) / (size * SWIPE_ENGAGE_SHARE);
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
    travelToward(side, dx, dy) >= (side === 'down' ? height : width) * FLING_MIN_TRAVEL_SHARE;
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
  | { type: 'press'; decision: ReviewDecision; canApprove: boolean }
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
    case 'press':
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
