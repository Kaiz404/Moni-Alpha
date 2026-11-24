export type Clip =
  | 'home-overview'
  | 'quick-add'
  | 'scan-receipt'
  | 'review-captures'
  | 'spend-pace'
  | 'places-map';

/** One range of a clip. Times are seconds into the clip. `hold` freezes the last frame for that many seconds. `cut` enters with a hard cut instead of a dissolve. */
export type Shot = {
  clip: Clip;
  from: number;
  to: number;
  hold?: number;
  cut?: boolean;
  label: string;
};

export type Frame = 'portrait' | 'square' | 'wide';

export type Loop = {
  id: string;
  frame: Frame;
  shots: Shot[];
};

const home: Shot = {clip: 'home-overview', from: 0.8, to: 3.4, label: 'Every wallet at a glance'};
const quickAdd: Shot = {clip: 'quick-add', from: 16.8, to: 19.9, label: 'Type it, Moni drafts it'};
const scanChooser: Shot = {clip: 'scan-receipt', from: 1.6, to: 2.6, label: 'Scan a receipt'};
const scanResult: Shot = {clip: 'scan-receipt', from: 14.9, to: 16.1, hold: 1.0, label: 'Scan a receipt'};
const review: Shot = {clip: 'review-captures', from: 1.4, to: 4.0, label: 'Swipe to review'};
const pace: Shot = {clip: 'spend-pace', from: 4.8, to: 8.4, label: 'Your spending pace'};
const map: Shot = {clip: 'places-map', from: 5.7, to: 8.2, label: 'Where you spend'};

const tour: Shot[] = [home, quickAdd, scanChooser, scanResult, review, pace, map];

export const loops: Loop[] = [
  {id: 'StillTour', frame: 'portrait', shots: tour},
  {id: 'StillTourSquare', frame: 'square', shots: tour},
  {id: 'StillTourWide', frame: 'wide', shots: tour},
  {id: 'StillHome', frame: 'portrait', shots: [{...home, from: 0.2, to: 8.4}]},
  {
    id: 'StillQuickAdd',
    frame: 'portrait',
    shots: [
      {...quickAdd, from: 16.7, to: 18.9, hold: 2.0},
      {...quickAdd, from: 18.9, to: 20.6, hold: 0.6, cut: true},
    ],
  },
  {
    id: 'StillScan',
    frame: 'portrait',
    shots: [
      {...scanChooser, from: 0.6, to: 2.6, hold: 0.6},
      {...scanResult, from: 14.9, to: 16.1, hold: 1.2},
      {...scanResult, from: 16.1, to: 17.6, hold: 1.0, cut: true},
    ],
  },
  {id: 'StillReview', frame: 'portrait', shots: [{...review, from: 1.0, to: 9.0}]},
  {id: 'StillPace', frame: 'portrait', shots: [{...pace, from: 3.6, to: 10.8}]},
  {id: 'StillMap', frame: 'portrait', shots: [{...map, from: 4.9, to: 12.3}]},
];
