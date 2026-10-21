import { FLING_COMMIT_THRESHOLD, projectedPosition } from '@/lib/motion/tokens';
import type { ReviewField, ReviewResult } from '@/lib/proposals/review-actions';

export type ReviewDecision = 'approve' | 'notMine' | 'later';
export type EditField = 'merchant' | 'amount';

/** One pan frame: offset and velocity in px and px/s, against the card's own size. */
export type Swipe = {
  dx: number;
  dy: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  /** Approve needs a wallet; without one a right swipe asks for it instead. */
  canApprove: boolean;
};

export type SwipeIntent = ReviewDecision | 'needsWallet' | null;

/**
 * Where the swipe is headed, on the projected position x + 0.5·v against 40% of the card:
 * right Approve, left Not mine, down Later. Runs on the UI thread every frame.
 */
export function swipeIntent(swipe: Swipe): SwipeIntent {
  'worklet';
  const x = projectedPosition(swipe.dx, swipe.vx);
  const y = projectedPosition(swipe.dy, swipe.vy);
  if (Math.abs(x) >= Math.abs(y)) {
    if (x > swipe.width * FLING_COMMIT_THRESHOLD) return swipe.canApprove ? 'approve' : 'needsWallet';
    if (x < -swipe.width * FLING_COMMIT_THRESHOLD) return 'notMine';
    return null;
  }
  return y > swipe.height * FLING_COMMIT_THRESHOLD ? 'later' : null;
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
  | { type: 'drag'; swipe: Swipe }
  | { type: 'release'; swipe: Swipe }
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
      const intent = swipeIntent(event.swipe);
      return intent === null || intent === 'needsWallet' ? { kind: 'dragging' } : ARMED[intent];
    }
    case 'release': {
      if (!canDrag(state)) return state;
      const intent = swipeIntent(event.swipe);
      if (intent === null) return idle;
      if (intent === 'needsWallet') return { kind: 'needsInput', field: 'wallet' };
      return decide(intent, event.swipe.canApprove);
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
