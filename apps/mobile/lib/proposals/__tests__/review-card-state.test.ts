import {
  armedDecision,
  cardFit,
  idle,
  nextSelection,
  OPEN_ROOM,
  releasedSelection,
  releaseIntent,
  reviewCardReducer,
  selectionIntent,
  selectionReach,
  swipeEngageAt,
  swipeRoom,
  type ReviewCardEvent,
  type ReviewCardState,
  type SwipeIntent,
  type SwipeSelection,
} from '../review-card-state';

const W = 342;
const PHONE_WIDTH = 390;

const run = (events: ReviewCardEvent[], from: ReviewCardState = idle) =>
  events.reduce(reviewCardReducer, from);

/** `right` leans, `right!` is engaged, `-` is nothing. Each frame starts from the one before. */
function walk(path: number[], room = OPEN_ROOM): string[] {
  let selection: SwipeSelection = null;
  return path.map((dx) => {
    selection = nextSelection(selection, { dx, width: W, room });
    return selection ? `${selection.side}${selection.engaged ? '!' : ''}` : '-';
  });
}

describe('swipeEngageAt', () => {
  it('asks for 45% of the card width either way when the finger has the room', () => {
    const offset = { dx: 0, width: 342, room: OPEN_ROOM };
    expect(swipeEngageAt('right', offset)).toBeCloseTo(153.9);
    expect(swipeEngageAt('left', offset)).toBeCloseTo(153.9);
  });
});

describe('which option a drag selects', () => {
  it.each<[string, number[], string[]]>([
    ['nothing leans inside the dead zone', [0, 5, -5, 15, -15], ['-', '-', '-', '-', '-']],
    [
      'tremor on the lean edge leans once',
      [14, 17, 13, 18, 9, 17],
      ['-', 'right', 'right', 'right', 'right', 'right'],
    ],
    ['wobble across the centre stays unlit', [20, 3, -3, 3, -3], ['right', '-', '-', '-', '-']],
    [
      'jitter on the right engage line engages once',
      [150, 155, 150, 156, 125, 155],
      ['right', 'right!', 'right!', 'right!', 'right!', 'right!'],
    ],
    [
      'jitter on the right release line lets go once',
      [160, 122, 118, 122, 118, 150, 155],
      ['right!', 'right!', 'right', 'right', 'right', 'right', 'right!'],
    ],
    [
      'jitter on the left engage line engages once',
      [-150, -155, -150, -156, -125],
      ['left', 'left!', 'left!', 'left!', 'left!'],
    ],
    [
      'a deliberate change from right to left still switches',
      [160, 60, 0, -60, -160],
      ['right!', 'right', '-', 'left', 'left!'],
    ],
    ['a frame that jumps across goes straight to the other side', [160, -160], ['right!', 'left!']],
  ])('%s', (_name, path, expected) => {
    expect(walk(path)).toEqual(expected);
  });

  it('hands back the same selection while nothing changes, so the UI thread does no work', () => {
    const offset = { dx: 160, width: W, room: OPEN_ROOM };
    const engaged = nextSelection(null, offset);
    expect(nextSelection(engaged, { ...offset, dx: 170 })).toBe(engaged);
  });

  it('reports one armed change, and so one haptic, through jitter on the engage line', () => {
    let selection: SwipeSelection = null;
    let last: SwipeIntent = null;
    const sent: SwipeIntent[] = [];
    for (const dx of [150, 155, 150, 156, 148, 158, 151, 157]) {
      selection = nextSelection(selection, { dx, width: W, room: OPEN_ROOM });
      const now = selectionIntent(selection, true);
      if (now !== last) sent.push(now);
      last = now;
    }
    expect(sent).toEqual(['approve']);
    expect(armedDecision(run(sent.map((intent) => ({ type: 'drag', intent }))))).toBe('approve');
  });

  it('a right swipe without a wallet selects the ask, which arms nothing', () => {
    const selection = nextSelection(null, { dx: 200, width: W, room: OPEN_ROOM });
    const intent = selectionIntent(selection, false);
    expect(intent).toBe('needsWallet');
    expect(run([{ type: 'drag', intent }])).toEqual({ kind: 'dragging' });
    expect(run([{ type: 'release', intent }])).toEqual({ kind: 'needsInput', field: 'wallet' });
  });

  it('reach follows the card to the engage line, and only for its own side', () => {
    const offset = { width: W, room: OPEN_ROOM };
    const right: SwipeSelection = { side: 'right', engaged: false };
    expect(selectionReach(right, { ...offset, dx: 76.95 })).toBeCloseTo(0.5);
    expect(selectionReach(right, { ...offset, dx: 400 })).toBe(1);
    expect(selectionReach(right, { ...offset, dx: -40 })).toBe(0);
    expect(selectionReach(null, { ...offset, dx: 100 })).toBe(0);
  });
});

describe('where the finger starts', () => {
  const from = (x: number) => swipeRoom(x, PHONE_WIDTH);

  it('measures the room from the touch to each side of the screen', () => {
    expect(from(340)).toEqual({ right: 50, left: 340 });
  });

  it.each<[string, number, number[], string[]]>([
    ['a start at the left needs the normal 45% of the card', 40, [150, 155], ['right', 'right!']],
    ['a start at the centre needs 60% of the 195 to the edge', 195, [110, 118], ['right', 'right!']],
    [
      'a start near the right edge engages Approve with the 30 it needs',
      340,
      [20, 29, 31],
      ['right', 'right', 'right!'],
    ],
    [
      'the last px of the card still reaches Approve, on the floor of 20',
      366,
      [17, 19, 21],
      ['right', 'right', 'right!'],
    ],
    ['a twitch beside the edge engages nothing', 366, [8, 14, 8], ['-', '-', '-']],
    [
      'a start near the left edge engages Not mine the same way',
      50,
      [-20, -29, -31],
      ['left', 'left', 'left!'],
    ],
    [
      'jitter on the short engage line engages once',
      340,
      [29, 31, 29, 32, 25, 31],
      ['right', 'right!', 'right!', 'right!', 'right!', 'right!'],
    ],
    [
      'the short release band is still 12 wide, so jitter on it lets go once',
      340,
      [31, 19, 17, 19, 17, 29, 31],
      ['right!', 'right!', 'right', 'right', 'right', 'right', 'right!'],
    ],
  ])('%s', (_name, x, path, expected) => {
    expect(walk(path, from(x))).toEqual(expected);
  });

  it('a highlighted option near the edge is the one the release commits', () => {
    const selection = nextSelection(null, { dx: 31, width: W, room: from(340) });
    expect(selection).toEqual({ side: 'right', engaged: true });
    expect(
      releaseIntent(selection, { dx: 31, dy: 0, vx: 0, vy: 0, width: W, canApprove: true }),
    ).toBe('approve');
  });

  it('a fling from the left still commits before anything engages', () => {
    const selection = nextSelection(null, { dx: 60, width: W, room: from(40) });
    expect(selection).toEqual({ side: 'right', engaged: false });
    expect(
      releaseIntent(selection, { dx: 60, dy: 0, vx: 1500, vy: 0, width: W, canApprove: true }),
    ).toBe('approve');
  });

  it('reach fills to the short engage line, so the cue lights when the option does', () => {
    const offset = { width: W, room: from(340) };
    const right: SwipeSelection = { side: 'right', engaged: false };
    expect(selectionReach(right, { ...offset, dx: 15 })).toBe(0.5);
    expect(selectionReach(right, { ...offset, dx: 30 })).toBe(1);
  });
});

describe('what the release commits', () => {
  const none: SwipeSelection = null;
  const lean: SwipeSelection = { side: 'right', engaged: false };
  const right: SwipeSelection = { side: 'right', engaged: true };
  const left: SwipeSelection = { side: 'left', engaged: true };

  it.each<[string, SwipeSelection, [number, number, number, number], SwipeIntent]>([
    ['an engaged option, held still', right, [160, 0, 0, 0], 'approve'],
    ['an engaged option, drifting back slowly', right, [130, 0, -300, 0], 'approve'],
    ['an engaged option, flung back against', right, [130, 0, -1200, 0], null],
    ['an engaged Not mine', left, [-160, 0, 0, 0], 'notMine'],
    ['a drag short of the line, held still', lean, [150, 0, 0, 0], null],
    ['a gentle lift the old projection committed', lean, [60, 0, 300, 0], null],
    ['a fling from 30% of the card', lean, [103, 0, 2000, 0], 'approve'],
    ['a short fast flick', none, [50, 0, 1500, 0], 'approve'],
    ['a twitch that hardly moved the card', none, [30, 0, 1500, 0], null],
    ['a fling left', none, [-60, 0, -1500, 0], 'notMine'],
    ['a fling down decides nothing', none, [0, 80, 0, 1500], null],
    ['a fling up decides nothing', none, [0, -80, 0, -2000], null],
    ['a fling mostly down with a sideways drift decides nothing', none, [50, 120, 900, 2000], null],
    ['a fling from the far side of the centre', none, [-30, 0, 2000, 0], null],
    ['a diagonal fling goes the way it mostly travels', none, [100, 30, 1400, 900], 'approve'],
  ])('%s', (_name, selection, [dx, dy, vx, vy], expected) => {
    expect(releaseIntent(selection, { dx, dy, vx, vy, width: W, canApprove: true })).toBe(expected);
  });

  it('an engaged right swipe or a right fling asks for a wallet when there is none', () => {
    const swipe = { dy: 0, vy: 0, width: W, canApprove: false };
    expect(releaseIntent(right, { ...swipe, dx: 160, vx: 0 })).toBe('needsWallet');
    expect(releaseIntent(none, { ...swipe, dx: 60, vx: 1500 })).toBe('needsWallet');
  });

  it('keeps the committed side lit for the flight, and lets go on a snap-back', () => {
    expect(releasedSelection(null, 'notMine')).toEqual({ side: 'left', engaged: true });
    expect(releasedSelection(null, 'approve')).toEqual({ side: 'right', engaged: true });
    expect(releasedSelection(right, null)).toEqual({ side: 'right', engaged: false });
    expect(releasedSelection(right, 'needsWallet')).toEqual({ side: 'right', engaged: false });
    expect(releasedSelection(null, null)).toBeNull();
  });

  it('the release saves what it was given, and nothing returns to idle', () => {
    expect(run([{ type: 'release', intent: 'notMine' }])).toEqual({
      kind: 'saving',
      decision: 'notMine',
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

describe('decisions and results', () => {
  it('Approve without a wallet asks for one; after the pick it saves', () => {
    const asked = run([{ type: 'decide', decision: 'approve', canApprove: false }]);
    expect(asked).toEqual({ kind: 'needsInput', field: 'wallet' });
    expect(
      run([{ type: 'resolved' }, { type: 'decide', decision: 'approve', canApprove: true }], asked),
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

describe('cardFit', () => {
  const FULLEST = { place: false, quote: true, evidence: true, pair: true, similar: true };
  const ALERT = { place: false, quote: true, evidence: false, pair: false, similar: true };
  const DUPLICATE = { place: false, quote: true, evidence: true, pair: true, similar: false };
  const PLACED = { ...FULLEST, place: true };

  it.each([
    ['the 560 card', FULLEST, 560, 1, { quoteLines: 2, evidenceLines: 2, similar: true }],
    ['the 560 card', ALERT, 560, 1, { quoteLines: 3, evidenceLines: 2, similar: true }],
    ['the 560 card', DUPLICATE, 560, 1, { quoteLines: 3, evidenceLines: 2, similar: true }],
    ['the 560 card', PLACED, 560, 1, { quoteLines: 1, evidenceLines: 2, similar: true }],
    ['the 560 card', { ...ALERT, place: true }, 560, 1, { quoteLines: 3, evidenceLines: 2, similar: true }],
    ['a 360x800 deck', FULLEST, 534, 1, { quoteLines: 0, evidenceLines: 2, similar: true }],
    ['a 360x800 deck', ALERT, 534, 1, { quoteLines: 3, evidenceLines: 2, similar: true }],
    ['a 360x640 deck', FULLEST, 422, 1, { quoteLines: 0, evidenceLines: 0, similar: false }],
    ['a 360x640 deck', ALERT, 422, 1, { quoteLines: 0, evidenceLines: 2, similar: true }],
    ['a 360x640 deck', DUPLICATE, 422, 1, { quoteLines: 0, evidenceLines: 1, similar: true }],
    ['large text', FULLEST, 560, 1.3, { quoteLines: 0, evidenceLines: 2, similar: true }],
    ['large text', ALERT, 560, 1.3, { quoteLines: 3, evidenceLines: 2, similar: true }],
  ])('on %s gives way in order: %j at %i, scale %d', (_name, parts, height, scale, fit) => {
    expect(cardFit(parts, height, scale)).toEqual(fit);
  });

  it('keeps the plainest fit on a deck too short for anything', () => {
    expect(cardFit(FULLEST, 100, 1)).toEqual({ quoteLines: 0, evidenceLines: 0, similar: false });
  });
});
