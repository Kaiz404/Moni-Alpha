import type {Layout, Segment, Shot} from '../../film/types';

// Every number here is data: shot length, camera and echo timing in seconds from the shot's start, clip times in source seconds.
// Camera poses reuse the first cut's Pose: `zoom` scales the phone around the screen point (`fx`, `fy`), `lift` moves it up or down in phone heights, angles stay within a few degrees.

export type Side = 'left' | 'right';

/** A word or number taken from the screen at `at` seconds into the shot, set huge under the headline. */
export type Echo = {text: string; at: number};

export type EditorialShot = Shot & {
  side: Side;
  lines: string[];
  sub?: string;
  echo?: Echo;
};

export type EndCard = {id: string; dur: number; lines: string[]; sub: string};

export type EditorialCut = {shots: EditorialShot[]; end: EndCard};

const end: EndCard = {id: 'end', dur: 3.6, lines: ['Money,', 'made clear.'], sub: 'On Android and the web.'};

const play = (...segs: Segment[]) => segs;

const home: EditorialShot = {
  id: 'home',
  dur: 4.0,
  side: 'right',
  play: play({clip: 'home-overview', from: 0.3, to: 4.3}),
  from: {ry: -4, zoom: 1, fy: 0.5},
  moves: [
    {at: 0, over: 4, to: {ry: -2, lift: -0.01}, ease: 'drift'},
    {at: 0.8, over: 1.4, to: {zoom: 1.32, fy: 0.2}, ease: 'glide'},
  ],
  lines: ['Every wallet,', 'one look.'],
  sub: 'Every account in one strip.',
  echo: {text: 'RM2,431.80', at: 0.9},
};

const quickAdd: EditorialShot = {
  id: 'quick-add',
  dur: 3.8,
  side: 'left',
  play: play({clip: 'quick-add', from: 16.7, to: 19.0}),
  from: {ry: 4, zoom: 1.5, fy: 0.65, lift: -0.43},
  moves: [
    {at: 0, over: 3.8, to: {ry: 2, lift: -0.45}, ease: 'drift'},
    {at: 0.9, over: 1.2, to: {zoom: 1.62}, ease: 'glide'},
  ],
  lines: ['Just say', 'what you spent.'],
  sub: 'Moni drafts it. You approve.',
  echo: {text: 'RM6.00', at: 1.0},
};

const scan: EditorialShot = {
  id: 'scan',
  dur: 4.4,
  side: 'right',
  play: play(
    {clip: 'scan-receipt', from: 1.5, to: 2.75},
    {clip: 'scan-receipt', from: 14.9, to: 16.1, speed: 0.6},
    {clip: 'scan-receipt', from: 16.25, to: 17.3},
  ),
  from: {ry: -4, zoom: 1, fy: 0.5},
  moves: [
    {at: 0, over: 4.4, to: {ry: -2}, ease: 'drift'},
    {at: 1.25, over: 0.9, to: {zoom: 1.3, fy: 0.34}, ease: 'glide'},
    {at: 3.25, over: 1.0, to: {zoom: 1.05, fy: 0.45}, ease: 'glide'},
  ],
  lines: ['Snap the', 'receipt.'],

  sub: 'Moni reads the rest.',
  echo: {text: 'RM15.30', at: 1.35},
};

const review: EditorialShot = {
  id: 'review',
  dur: 4.4,
  side: 'left',
  play: play({clip: 'review-captures', from: 1.5, to: 5.0, speed: 1.25}, {clip: 'review-captures', from: 13.0, to: 14.7}),
  from: {ry: 4, zoom: 1.1, fy: 0.45},
  moves: [
    {at: 0, over: 4.4, to: {ry: 2}, ease: 'drift'},
    {at: 2.8, over: 0.9, to: {zoom: 1.28, fy: 0.22}, ease: 'glide'},
  ],
  lines: ['Swipe to', 'approve.'],
  sub: 'Bank alerts, already caught.',
  echo: {text: '3 approved', at: 2.9},
};

const pace: EditorialShot = {
  id: 'pace',
  dur: 3.8,
  side: 'right',
  play: play({clip: 'spend-pace', from: 0.8, to: 3.0}, {clip: 'spend-pace', from: 11.1, to: 12.7}),
  from: {ry: -4, zoom: 1.15, fy: 0.45},
  moves: [
    {at: 0, over: 3.8, to: {ry: -2}, ease: 'drift'},
    {at: 0.4, over: 1.6, to: {zoom: 1.38, fy: 0.52}, ease: 'glide'},
  ],
  lines: ['Know your', 'pace.'],
  sub: 'Spend against your budget.',
};

const calendar: EditorialShot = {
  id: 'calendar',
  dur: 3.6,
  side: 'left',
  play: play({clip: 'spend-calendar', from: 4.25, to: 8.4, speed: 1.15}),
  from: {ry: 4, zoom: 1.15, fy: 0.3},
  moves: [
    {at: 0, over: 3.6, to: {ry: 2}, ease: 'drift'},
    {at: 0.5, over: 1.6, to: {zoom: 1.32, fy: 0.3}, ease: 'glide'},
  ],
  lines: ['Spot the', 'heavy days.'],
  sub: 'Every day, heated by spend.',
};

export const heroCut: EditorialCut = {shots: [home, quickAdd, scan, review, pace, calendar], end};

export const scanSpotCut: EditorialCut = {
  shots: [
    {
      id: 'spot-snap',
      dur: 2.2,
      side: 'right',
      play: play({clip: 'scan-receipt', from: 1.3, to: 2.75}),
      from: {ry: -4, zoom: 1.05, fy: 0.6},
      moves: [{at: 0, over: 2.2, to: {ry: -2, zoom: 1.12, fy: 0.66}, ease: 'drift'}],
      lines: ['Snap the', 'receipt.'],
    },
    {
      id: 'spot-read',
      dur: 4.0,
      side: 'right',
      play: play({clip: 'scan-receipt', from: 14.9, to: 16.1, speed: 0.5}, {clip: 'scan-receipt', from: 16.25, to: 17.3}),
      from: {ry: -3, zoom: 1.05, fy: 0.4},
      moves: [
        {at: 0, over: 4, to: {ry: -1.5}, ease: 'drift'},
        {at: 0.3, over: 1.0, to: {zoom: 1.32, fy: 0.34}, ease: 'glide'},
        {at: 2.4, over: 1.0, to: {zoom: 1.08, fy: 0.45}, ease: 'glide'},
      ],
      lines: ['Moni reads', 'the rest.'],
      echo: {text: 'RM15.30', at: 0.4},
    },
  ],
  end: {...end, dur: 3.0},
};

export const cutLength = (cut: EditorialCut) => cut.shots.reduce((t, s) => t + s.dur, 0) + cut.end.dur;

export const editorialCuts = {
  EditorialHero: {cut: heroCut, layout: 'portrait'},
  EditorialHeroLandscape: {cut: heroCut, layout: 'landscape'},
  EditorialSpotScan: {cut: scanSpotCut, layout: 'portrait'},
} satisfies Record<string, {cut: EditorialCut; layout: Layout}>;
