import {
  armedDecision,
  idle,
  nextSelection,
  releasedSelection,
  releaseIntent,
  reviewCardReducer,
  selectionIntent,
  selectionReach,
  type ReviewCardEvent,
  type ReviewCardState,
  type SwipeIntent,
  type SwipeSelection,
} from '../review-card-state';

const W = 342;
const H = 480;

const run = (events: ReviewCardEvent[], from: ReviewCardState = idle) =>
  events.reduce(reviewCardReducer, from);

/** `right` leans, `right!` is engaged, `-` is nothing. Each frame starts from the one before. */
function walk(path: [number, number][]): string[] {
  let selection: SwipeSelection = null;
  return path.map(([dx, dy]) => {
    selection = nextSelection(selection, { dx, dy, width: W, height: H });
    return selection ? `${selection.side}${selection.engaged ? '!' : ''}` : '-';
  });
}

describe('which option a drag selects', () => {
  it.each<[string, [number, number][], string[]]>([
    [
      'nothing leans inside the dead zone',
      [[0, 0], [5, 0], [-5, 0], [15, 0], [-15, 0], [0, 15]],
      ['-', '-', '-', '-', '-', '-'],
    ],
    [
      'tremor on the lean edge leans once',
      [[14, 0], [17, 0], [13, 0], [18, 0], [9, 0], [17, 0]],
      ['-', 'right', 'right', 'right', 'right', 'right'],
    ],
    [
      'wobble across the centre stays unlit',
      [[20, 0], [3, 0], [-3, 0], [3, 0], [-3, 0]],
      ['right', '-', '-', '-', '-'],
    ],
    [
      'jitter on the right engage line engages once',
      [[150, 0], [155, 0], [150, 0], [156, 0], [125, 0], [155, 0]],
      ['right', 'right!', 'right!', 'right!', 'right!', 'right!'],
    ],
    [
      'jitter on the right release line lets go once',
      [[160, 0], [122, 0], [118, 0], [122, 0], [118, 0], [150, 0], [155, 0]],
      ['right!', 'right!', 'right', 'right', 'right', 'right', 'right!'],
    ],
    [
      'jitter on the left engage line engages once',
      [[-150, 0], [-155, 0], [-150, 0], [-156, 0], [-125, 0]],
      ['left', 'left!', 'left!', 'left!', 'left!'],
    ],
    [
      'jitter on the down lines holds, with its own share of the taller card',
      [[0, 210], [0, 220], [0, 180], [0, 165], [0, 180], [0, 216]],
      ['down', 'down!', 'down!', 'down', 'down', 'down!'],
    ],
    [
      'a diagonal keeps the side it first leaned to',
      [[100, 100], [110, 95], [95, 110], [118, 100], [100, 118]],
      ['right', 'right', 'right', 'right', 'right'],
    ],
    [
      'an engaged option holds through a diagonal',
      [[170, 30], [170, 170], [165, 180], [170, 190]],
      ['right!', 'right!', 'right!', 'right!'],
    ],
    [
      'dragging up selects nothing',
      [[0, -100], [3, -200]],
      ['-', '-'],
    ],
    [
      'a deliberate change from right to left still switches',
      [[160, 0], [60, 0], [0, 0], [-60, 0], [-160, 0]],
      ['right!', 'right', '-', 'left', 'left!'],
    ],
    [
      'a frame that jumps across goes straight to the other side',
      [[160, 0], [-160, 0]],
      ['right!', 'left!'],
    ],
    [
      'a deliberate turn from right to down switches once down clearly leads',
      [[160, 0], [160, 180], [160, 190], [160, 220]],
      ['right!', 'right!', 'down', 'down!'],
    ],
  ])('%s', (_name, path, expected) => {
    expect(walk(path)).toEqual(expected);
  });

  it('hands back the same selection while nothing changes, so the UI thread does no work', () => {
    const offset = { dx: 160, dy: 0, width: W, height: H };
    const engaged = nextSelection(null, offset);
    expect(nextSelection(engaged, { ...offset, dx: 170 })).toBe(engaged);
  });

  it('reports one armed change, and so one haptic, through jitter on the engage line', () => {
    let selection: SwipeSelection = null;
    let last: SwipeIntent = null;
    const sent: SwipeIntent[] = [];
    for (const dx of [150, 155, 150, 156, 148, 158, 151, 157]) {
      selection = nextSelection(selection, { dx, dy: 0, width: W, height: H });
      const now = selectionIntent(selection, true);
      if (now !== last) sent.push(now);
      last = now;
    }
    expect(sent).toEqual(['approve']);
    expect(armedDecision(run(sent.map((intent) => ({ type: 'drag', intent }))))).toBe('approve');
  });

  it('a right swipe without a wallet selects the ask, which arms nothing', () => {
    const selection = nextSelection(null, { dx: 200, dy: 0, width: W, height: H });
    const intent = selectionIntent(selection, false);
    expect(intent).toBe('needsWallet');
    expect(run([{ type: 'drag', intent }])).toEqual({ kind: 'dragging' });
    expect(run([{ type: 'release', intent }])).toEqual({ kind: 'needsInput', field: 'wallet' });
  });

  it('reach follows the card to the engage line, and only for its own side', () => {
    const offset = { width: W, height: H };
    const right: SwipeSelection = { side: 'right', engaged: false };
    expect(selectionReach(right, { ...offset, dx: 76.95, dy: 0 })).toBeCloseTo(0.5);
    expect(selectionReach(right, { ...offset, dx: 400, dy: 0 })).toBe(1);
    expect(selectionReach(right, { ...offset, dx: -40, dy: 0 })).toBe(0);
    expect(selectionReach(null, { ...offset, dx: 100, dy: 0 })).toBe(0);
  });
});

describe('what the release commits', () => {
  const none: SwipeSelection = null;
  const lean: SwipeSelection = { side: 'right', engaged: false };
  const right: SwipeSelection = { side: 'right', engaged: true };
  const down: SwipeSelection = { side: 'down', engaged: true };

  it.each<[string, SwipeSelection, [number, number, number, number], SwipeIntent]>([
    ['an engaged option, held still', right, [160, 0, 0, 0], 'approve'],
    ['an engaged option, drifting back slowly', right, [130, 0, -300, 0], 'approve'],
    ['an engaged option, flung back against', right, [130, 0, -1200, 0], null],
    ['an engaged Later', down, [0, 230, 0, 0], 'later'],
    ['a drag short of the line, held still', lean, [150, 0, 0, 0], null],
    ['a gentle lift the old projection committed', lean, [60, 0, 300, 0], null],
    ['a fling from 30% of the card', lean, [103, 0, 2000, 0], 'approve'],
    ['a short fast flick', none, [50, 0, 1500, 0], 'approve'],
    ['a twitch that hardly moved the card', none, [30, 0, 1500, 0], null],
    ['a fling left', none, [-60, 0, -1500, 0], 'notMine'],
    ['a fling down', none, [0, 80, 0, 1500], 'later'],
    ['a fling up', none, [0, -80, 0, -2000], null],
    ['a fling from the far side of the centre', none, [-30, 0, 2000, 0], null],
    ['a diagonal fling goes the way it mostly travels', none, [100, 30, 1400, 900], 'approve'],
  ])('%s', (_name, selection, [dx, dy, vx, vy], expected) => {
    expect(
      releaseIntent(selection, { dx, dy, vx, vy, width: W, height: H, canApprove: true }),
    ).toBe(expected);
  });

  it('an engaged right swipe or a right fling asks for a wallet when there is none', () => {
    const swipe = { dy: 0, vy: 0, width: W, height: H, canApprove: false };
    expect(releaseIntent(right, { ...swipe, dx: 160, vx: 0 })).toBe('needsWallet');
    expect(releaseIntent(none, { ...swipe, dx: 60, vx: 1500 })).toBe('needsWallet');
  });

  it('keeps the committed side lit for the flight, and lets go on a snap-back', () => {
    expect(releasedSelection(null, 'later')).toEqual({ side: 'down', engaged: true });
    expect(releasedSelection(right, null)).toEqual({ side: 'right', engaged: false });
    expect(releasedSelection(right, 'needsWallet')).toEqual({ side: 'right', engaged: false });
    expect(releasedSelection(null, null)).toBeNull();
  });

  it('the release saves what it was given, and nothing returns to idle', () => {
    expect(run([{ type: 'release', intent: 'later' }])).toEqual({
      kind: 'saving',
      decision: 'later',
    });
    expect(run([{ type: 'drag', intent: 'notMine' }, { type: 'release', intent: null }])).toEqual({
      kind: 'idle',
    });
  });

  it('ignores the pan while a field is editing', () => {
    const editing = run([{ type: 'edit', field: 'amount' }]);
    expect(
      run(
        [
          { type: 'drag', intent: 'approve' },
          { type: 'release', intent: 'approve' },
        ],
        editing,
      ),
    ).toEqual({ kind: 'editing', field: 'amount' });
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
