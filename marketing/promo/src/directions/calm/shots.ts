import {checkCalm} from './timeline';
import type {Pose, Shot} from './types';

// Shot data. Times are shot seconds, `beat` values are source seconds from clips/manifest.json (or the frame the
// beat visibly lands on), angles are degrees and never pass 8 of yaw or 4 of tilt. To re-cut, edit this file only.

const WIDE: Partial<Pose> = {zoom: 0.94, fx: 0.5, fy: 0.5, ay: 0.5, rx: 0.6};
/** The phone turns a few degrees toward the caption beside it. */
const facing = (side: 'left' | 'right'): Partial<Pose> => ({...WIDE, ry: side === 'left' ? -4 : 4});

export const heroShots: Shot[] = checkCalm([
  {
    id: 'home',
    dur: 4.0,
    enter: {kind: 'cut'},
    play: [
      {clip: 'home-overview', from: 0.0, hold: 0.7},
      {clip: 'home-overview', from: 0.0, to: 3.4},
    ],
    from: facing('left'),
    caption: {title: 'Every coin, counted.', side: 'left', out: 1.75},
    moves: [
      {to: {zoom: 1.0}, land: 1.8, over: 1.8, ease: 'drift'},
      {to: {zoom: 1.6, fy: 0.27, ay: 0.46, ry: -1.5, rx: 1.2}, beat: 2.43, over: 1.3},
      {to: {zoom: 1.66}, land: 4.4, over: 1.2, ease: 'drift'},
    ],
  },
  {
    id: 'quick-add',
    dur: 4.0,
    enter: {kind: 'slide', over: 0.9},
    play: [
      {clip: 'quick-add', from: 16.6, hold: 1.0},
      {clip: 'quick-add', from: 16.6, to: 19.0},
    ],
    from: facing('right'),
    caption: {title: 'Just say what you spent.', sub: 'Moni drafts it.', side: 'right', out: 1.9},
    moves: [
      {to: {zoom: 2.0, fx: 0.48, fy: 0.7, ay: 0.35, ry: 1.5}, beat: 18.6, over: 1.1},
      {to: {zoom: 2.06}, land: 3.9, over: 1.2, ease: 'drift'},
    ],
  },
  {
    id: 'scan',
    dur: 4.35,
    enter: {kind: 'cut'},
    play: [
      {clip: 'scan-receipt', from: 1.6, hold: 0.6},
      {clip: 'scan-receipt', from: 1.6, to: 2.8},
      {clip: 'scan-receipt', from: 14.85, to: 16.1},
      {clip: 'scan-receipt', from: 16.3, to: 17.4},
    ],
    from: facing('left'),
    caption: {title: 'Snap the receipt.', sub: 'Moni reads the rest.', side: 'left', out: 1.35},
    moves: [
      {to: {zoom: 1.45, fy: 0.33, ay: 0.42, ry: 1}, beat: 14.85},
      {to: {zoom: 1.55}, beat: 16.1, over: 1.25, ease: 'drift'},
      {to: {zoom: 1.25, fy: 0.42, ay: 0.5, ry: -2}, beat: 16.3},
      {to: {zoom: 1.15}, land: 4.5, over: 1.4, ease: 'drift'},
    ],
  },
  {
    id: 'review',
    dur: 4.1,
    enter: {kind: 'slide', over: 0.9},
    play: [
      {clip: 'review-captures', from: 0.3, hold: 1.4},
      {clip: 'review-captures', from: 0.3, to: 1.8},
      {clip: 'review-captures', from: 14.1, to: 15.4},
    ],
    from: facing('right'),
    caption: {title: 'Every payment, caught.', sub: 'One swipe to approve.', side: 'right', out: 1.55},
    moves: [
      {to: {zoom: 1.6, fy: 0.5, ay: 0.5, ry: 1.5}, beat: 1.5, over: 1.1},
      {to: {zoom: 1.6, fy: 0.3, ay: 0.45}, land: 2.9},
      {to: {zoom: 1.68}, land: 4.3, over: 1.3, ease: 'drift'},
    ],
  },
  {
    id: 'pace',
    dur: 3.8,
    enter: {kind: 'cut'},
    play: [
      {clip: 'spend-pace', from: 0.8, hold: 0.6},
      {clip: 'spend-pace', from: 0.8, to: 3.1},
      {clip: 'spend-pace', from: 11.85, to: 12.75},
    ],
    from: {...facing('left'), rx: 1.2},
    caption: {title: 'Know your pace.', side: 'left', out: 1.45},
    moves: [
      {to: {zoom: 1.9, fy: 0.46, ay: 0.5, ry: -1}, beat: 2.71, over: 1.1},
      {to: {zoom: 1.95}, land: 3.9, over: 1.0, ease: 'drift'},
    ],
  },
  {
    id: 'calendar',
    dur: 4.05,
    enter: {kind: 'slide', over: 0.9},
    play: [{clip: 'spend-calendar', from: 3.9, to: 7.95}],
    from: facing('right'),
    caption: {title: 'Spot the heavy days.', side: 'right', out: 1.45},
    moves: [
      {to: {zoom: 1.7, fy: 0.4, ay: 0.5, ry: 1.5}, beat: 6.31, over: 1.0},
      {to: {zoom: 1.75, fy: 0.44}, beat: 7.79, over: 1.2, ease: 'drift'},
    ],
  },
  {
    id: 'map',
    dur: 3.6,
    enter: {kind: 'cut'},
    play: [
      {clip: 'places-map', from: 4.95, hold: 1.4},
      {clip: 'places-map', from: 4.95, to: 6.9},
    ],
    from: facing('left'),
    caption: {title: 'See where you spend.', side: 'left', out: 1.55},
    moves: [
      {to: {zoom: 1.75, fy: 0.24, ay: 0.5, ry: -1, rx: 2}, beat: 6.19, over: 1.1},
      {to: {zoom: 1.8}, land: 3.8, over: 1.0, ease: 'drift'},
    ],
  },
  {
    id: 'end',
    dur: 3.4,
    enter: {kind: 'slide', over: 0.9},
    play: [{clip: 'home-overview', from: 0.0, hold: 1}],
    from: WIDE,
    end: {title: 'Money, made clear.', sub: 'On Android and the web.', side: 'right'},
    moves: [{to: {zoom: 0.6, ay: 0.33, ry: 3, rx: 1}, wide: {zoom: 0.86, ay: 0.5}, land: 1.6, over: 1.5}],
  },
]);
