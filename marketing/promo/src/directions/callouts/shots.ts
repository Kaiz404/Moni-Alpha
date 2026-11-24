import type {Segment} from '../../film/types';

/** A region of the phone screen, 0 to 1 from the top left. */
export type Crop = {x: number; y: number; w: number; h: number};

/** From `at` seconds into the shot, for `dur` seconds, `crop` lifts out of the screen as a card `zoom` times its on-screen size. `place` puts the card above or below its source in the portrait cut. */
export type Callout = {at: number; dur: number; crop: Crop; zoom: number; place?: 'above' | 'below'; title: string; sub?: string};

/** `side` is where the callout cards sit; the phone moves to the other side. */
export type Shot = {id: string; dur: number; play: Segment[]; side: 'left' | 'right' | 'center'; callouts: Callout[]; end?: {title: string; sub?: string}};

export type Layout = 'portrait' | 'landscape';
export type Cut = {id: string; layout: Layout; shots: Shot[]};

export const CROP = {
  netWorth: {x: 0, y: 0.115, w: 1, h: 0.205},
  askBar: {x: 0.03, y: 0.68, w: 0.94, h: 0.065},
  draft: {x: 0.04, y: 0.533, w: 0.92, h: 0.232},
  draftActions: {x: 0.04, y: 0.533, w: 0.92, h: 0.305},
  receipt: {x: 0.04, y: 0.158, w: 0.92, h: 0.25},
  reviewCard: {x: 0, y: 0.405, w: 1, h: 0.18},
  paceChart: {x: 0.04, y: 0.39, w: 0.92, h: 0.24},
  mapPins: {x: 0, y: 0.165, w: 1, h: 0.2},
} satisfies Record<string, Crop>;

const END = {title: 'Money, made clear.', sub: 'On Android and the web.'};

const heroShots: Shot[] = [
  {
    id: 'home',
    dur: 3.6,
    play: [{clip: 'home-overview', from: 0.3, to: 3.3}],
    side: 'right',
    callouts: [{at: 0.5, dur: 2.9, crop: CROP.netWorth, zoom: 1.5, place: 'below', title: 'Every wallet, one place.'}],
  },
  {
    id: 'quick-add',
    dur: 3.4,
    play: [{clip: 'quick-add', from: 16.4, to: 19.1, speed: 0.8}],
    side: 'left',
    callouts: [{at: 0.3, dur: 2.9, crop: CROP.draftActions, zoom: 1.6, place: 'above', title: 'Just say what you spent.', sub: 'Moni drafts it. You approve.'}],
  },
  {
    id: 'scan',
    dur: 4.4,
    play: [
      {clip: 'scan-receipt', from: 1.5, to: 2.8},
      {clip: 'scan-receipt', from: 14.9, to: 15.95, speed: 0.5},
      {clip: 'scan-receipt', from: 16.15, to: 17.0},
    ],
    side: 'right',
    callouts: [{at: 1.45, dur: 2.0, crop: CROP.receipt, zoom: 1.55, place: 'below', title: 'Snap the receipt.', sub: 'Moni reads every line.'}],
  },
  {
    id: 'review',
    dur: 3.8,
    play: [{clip: 'review-captures', from: 0.4, to: 4.2}],
    side: 'left',
    callouts: [{at: 0.25, dur: 3.2, crop: CROP.reviewCard, zoom: 1.5, place: 'below', title: 'Every payment, caught.', sub: 'Swipe right to approve.'}],
  },
  {
    id: 'pace',
    dur: 3.6,
    play: [{clip: 'spend-pace', from: 0.6, to: 3.4}],
    side: 'right',
    callouts: [{at: 0.3, dur: 3.0, crop: CROP.paceChart, zoom: 1.55, place: 'above', title: 'Know your pace.'}],
  },
  {
    id: 'map',
    dur: 3.6,
    play: [{clip: 'places-map', from: 5.2, to: 8.8}],
    side: 'left',
    callouts: [{at: 0.3, dur: 3.0, crop: CROP.mapPins, zoom: 1.6, place: 'below', title: 'See where you spend.'}],
  },
  {id: 'end', dur: 3.4, play: [{clip: 'places-map', from: 8.8, to: 8.8}], side: 'center', callouts: [], end: END},
];

const spotQuickAddShots: Shot[] = [
  {
    id: 'ask',
    dur: 2.2,
    play: [{clip: 'quick-add', from: 0, to: 1.3, speed: 0.6}],
    side: 'right',
    callouts: [{at: 0.3, dur: 1.85, crop: CROP.askBar, zoom: 1.6, place: 'above', title: 'Just say what you spent.'}],
  },
  {
    id: 'draft',
    dur: 2.5,
    play: [{clip: 'quick-add', from: 16.4, to: 18.9}],
    side: 'right',
    callouts: [{at: 0.2, dur: 2.25, crop: CROP.draft, zoom: 1.6, place: 'above', title: 'Moni drafts it.'}],
  },
  {
    id: 'approve',
    dur: 1.9,
    play: [{clip: 'quick-add', from: 18.6, to: 19.1, speed: 0.27}],
    side: 'right',
    callouts: [{at: 0.15, dur: 1.75, crop: CROP.draftActions, zoom: 1.5, place: 'above', title: 'You approve.'}],
  },
  {id: 'end', dur: 2.4, play: [{clip: 'quick-add', from: 19.0, to: 19.0}], side: 'center', callouts: [], end: END},
];

export const cuts: Cut[] = [
  {id: 'CalloutsHero', layout: 'portrait', shots: heroShots},
  {id: 'CalloutsLandscape', layout: 'landscape', shots: heroShots},
  {id: 'CalloutsSpotQuickAdd', layout: 'portrait', shots: spotQuickAddShots},
];

export const totalDur = (shots: Shot[]) => shots.reduce((t, s) => t + s.dur, 0);
