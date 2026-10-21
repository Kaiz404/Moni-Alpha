import {
  idle,
  reviewCardReducer,
  type ReviewCardEvent,
  type ReviewCardState,
  type Swipe,
} from '../review-card-state';

const W = 342;
const H = 480;

function swipe(over: Partial<Swipe>): Swipe {
  return { dx: 0, dy: 0, vx: 0, vy: 0, width: W, height: H, canApprove: true, ...over };
}

const run = (events: ReviewCardEvent[], from: ReviewCardState = idle) =>
  events.reduce(reviewCardReducer, from);

describe('swipe on the Review card', () => {
  it('a drag to 45 percent with zero velocity arms Approve', () => {
    expect(run([{ type: 'drag', swipe: swipe({ dx: W * 0.45 }) }])).toEqual({
      kind: 'armedApprove',
    });
  });

  it('a drag to 30 percent at 2,000 px/s arms Approve, because the projection passes 40 percent', () => {
    expect(run([{ type: 'drag', swipe: swipe({ dx: W * 0.3, vx: 2000 }) }])).toEqual({
      kind: 'armedApprove',
    });
  });

  it('a drag to 30 percent with zero velocity returns to idle on release', () => {
    const slow = swipe({ dx: W * 0.3 });
    const dragging = run([{ type: 'drag', swipe: slow }]);
    expect(dragging).toEqual({ kind: 'dragging' });
    expect(reviewCardReducer(dragging, { type: 'release', swipe: slow })).toEqual({
      kind: 'idle',
    });
  });

  it('left arms Not mine, down arms Later, and release saves the armed decision', () => {
    expect(run([{ type: 'drag', swipe: swipe({ dx: -W * 0.5 }) }])).toEqual({
      kind: 'armedNotMine',
    });
    const down = swipe({ dy: H * 0.5 });
    expect(
      run([
        { type: 'drag', swipe: down },
        { type: 'release', swipe: down },
      ]),
    ).toEqual({ kind: 'saving', decision: 'later' });
  });

  it('a right swipe without a wallet asks for one instead of approving', () => {
    const right = swipe({ dx: W * 0.6, canApprove: false });
    expect(run([{ type: 'drag', swipe: right }])).toEqual({ kind: 'dragging' });
    expect(run([{ type: 'release', swipe: right }])).toEqual({
      kind: 'needsInput',
      field: 'wallet',
    });
  });

  it('ignores the pan while a field is editing', () => {
    const editing = run([{ type: 'edit', field: 'amount' }]);
    const far = swipe({ dx: W });
    expect(run([{ type: 'drag', swipe: far }, { type: 'release', swipe: far }], editing)).toEqual(
      { kind: 'editing', field: 'amount' },
    );
  });
});

describe('buttons and results', () => {
  it('Approve without a wallet asks for one; after the pick it saves', () => {
    const asked = run([{ type: 'press', decision: 'approve', canApprove: false }]);
    expect(asked).toEqual({ kind: 'needsInput', field: 'wallet' });
    expect(
      run([{ type: 'resolved' }, { type: 'press', decision: 'approve', canApprove: true }], asked),
    ).toEqual({ kind: 'saving', decision: 'approve' });
  });

  it('a failed save shows the error, and a done save returns to idle for the next card', () => {
    const saving: ReviewCardState = { kind: 'saving', decision: 'approve' };
    expect(
      reviewCardReducer(saving, {
        type: 'result',
        result: { status: 'error', message: "Couldn't save. Try again." },
      }),
    ).toEqual({ kind: 'error', message: "Couldn't save. Try again." });
    expect(
      reviewCardReducer(saving, {
        type: 'result',
        result: { status: 'needsInput', field: 'destination' },
      }),
    ).toEqual({ kind: 'needsInput', field: 'destination' });
  });
});
