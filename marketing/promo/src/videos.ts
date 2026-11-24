import type {Shot, Video} from './film/types';

// Every number here is data: shot length and camera timing in seconds from the shot's start, clip times in source seconds, angles in degrees.

const END_TITLE = 'Money, made clear.';
const END_SUB = 'On Android and the web.';

const heroShots: Shot[] = [
  {
    id: 'hook-home',
    dur: 2.8,
    play: [{clip: 'home-overview', from: 0.3, to: 3.3}],
    from: {ry: -160, rx: 18, rz: -14, lift: -0.5, zoom: 0.8},
    moves: [
      {at: 0, over: 1.6, to: {ry: -16, rx: 5, rz: 2, lift: 0, zoom: 1.05}, ease: 'settle'},
      {at: 1.5, over: 1.2, to: {ry: -10, zoom: 1.2, fy: 0.32}, ease: 'drift'},
      {at: 2.5, over: 0.3, to: {ry: 22}, ease: 'whip'},
    ],
    title: 'Every coin, counted.',
  },
  {
    id: 'quick-add',
    dur: 4.2,
    play: [
      {clip: 'quick-add', from: 11.0, to: 13.8},
      {clip: 'quick-add', from: 18.8, to: 20.3},
    ],
    from: {ry: -32, rx: 4, zoom: 1.05},
    moves: [
      {at: 0, over: 0.8, to: {ry: 12, rz: -1}, ease: 'settle'},
      {at: 0.5, over: 1.5, to: {zoom: 1.9, fy: 0.42}, ease: 'glide'},
      {at: 2.8, over: 1.3, to: {zoom: 1.7, fy: 0.84, ry: 6}, ease: 'glide'},
    ],
    title: 'Just say what you spent.',
    sub: 'Moni drafts it. You approve.',
  },
  {
    id: 'scan',
    dur: 3.9,
    play: [
      {clip: 'scan-receipt', from: 1.5, to: 2.8},
      {clip: 'scan-receipt', from: 12.45, to: 13.0},
      {clip: 'scan-receipt', from: 14.8, to: 15.9},
      {clip: 'scan-receipt', from: 16.2, to: 17.15},
    ],
    from: {ry: 36, rx: 6, zoom: 1.1, fy: 0.55},
    moves: [
      {at: 0, over: 0.8, to: {ry: -14, zoom: 1.35, fy: 0.62}, ease: 'settle'},
      {at: 1.2, over: 1.5, to: {ry: 10, zoom: 2.0, fy: 0.2}, ease: 'glide'},
      {at: 2.95, over: 1.0, to: {ry: 4, zoom: 1.15, fy: 0.45}, ease: 'glide'},
      {at: 3.6, over: 0.3, to: {ry: -24}, ease: 'whip'},
    ],
    title: 'Snap the receipt.',
    sub: 'Moni reads the rest.',
  },
  {
    id: 'review',
    dur: 4.4,
    play: [
      {clip: 'review-captures', from: 1.5, to: 5.0, speed: 1.25},
      {clip: 'review-captures', from: 12.0, to: 13.7},
    ],
    from: {ry: 34, rx: 5, zoom: 1.0, fy: 0.45},
    moves: [
      {at: 0, over: 0.9, to: {ry: 14, zoom: 1.3, fy: 0.42}, ease: 'settle'},
      {at: 2.6, over: 1.4, to: {ry: -8, zoom: 1.45, fy: 0.32}, ease: 'glide'},
    ],
    title: 'Every payment, caught.',
    sub: 'Swipe right to approve.',
  },
  {
    id: 'pace',
    dur: 3.7,
    play: [
      {clip: 'spend-pace', from: 0.8, to: 3.0},
      {clip: 'spend-pace', from: 11.1, to: 12.6},
    ],
    from: {ry: -30, rx: 10, zoom: 1.25, fy: 0.45},
    moves: [
      {at: 0, over: 1.2, to: {ry: -12, rx: 6, zoom: 1.75, fy: 0.47}, ease: 'settle'},
      {at: 2.1, over: 1.6, to: {ry: 8, zoom: 1.85}, ease: 'drift'},
      {at: 3.4, over: 0.3, to: {ry: 30}, ease: 'whip'},
    ],
    title: 'Know your pace.',
  },
  {
    id: 'calendar',
    dur: 3.6,
    play: [{clip: 'spend-calendar', from: 4.25, to: 8.4, speed: 1.15}],
    from: {ry: -34, rx: -4, zoom: 1.3, fy: 0.4},
    moves: [
      {at: 0, over: 1.0, to: {ry: 12, zoom: 1.6, fy: 0.42}, ease: 'settle'},
      {at: 1.6, over: 1.8, to: {fy: 0.5, zoom: 1.45, ry: 6}, ease: 'glide'},
    ],
    title: 'Spot the heavy days.',
  },
  {
    id: 'map',
    dur: 3.4,
    play: [{clip: 'places-map', from: 4.0, to: 7.3}],
    from: {ry: -25, rx: 12, zoom: 1.1, fy: 0.45},
    moves: [
      {at: 0, over: 1.2, to: {ry: -8, rx: 8, zoom: 1.45, fy: 0.4}, ease: 'settle'},
      {at: 1.2, over: 2.2, to: {ry: 4, zoom: 1.55}, ease: 'drift'},
    ],
    title: 'See where you spend.',
  },
  {
    id: 'end',
    dur: 3.4,
    play: [{clip: 'home-overview', from: 0.0, to: 0.2}],
    from: {ry: 30, zoom: 1.4, fy: 0.4},
    moves: [{at: 0, over: 1.6, to: {ry: -22, rx: 6, rz: 2, zoom: 0.95, fy: 0.5}, ease: 'settle'}],
    title: END_TITLE,
    sub: END_SUB,
    end: true,
  },
];

const endShot = (clip: Shot['play'][number]['clip'], at: number): Shot => ({
  id: 'end',
  dur: 2.4,
  play: [{clip, from: at, to: at}],
  from: {ry: 26, zoom: 1.3, fy: 0.45},
  moves: [{at: 0, over: 1.4, to: {ry: -20, rx: 6, rz: 2, zoom: 0.95, fy: 0.5}, ease: 'settle'}],
  title: END_TITLE,
  sub: END_SUB,
  end: true,
});

export const videos: Video[] = [
  {id: 'Hero', out: 'hero.mp4', layout: 'portrait', shots: heroShots},
  {id: 'HeroLandscape', out: 'hero-landscape.mp4', layout: 'landscape', shots: heroShots},
  {
    id: 'SpotQuickAdd',
    out: 'spot-quick-add.mp4',
    layout: 'portrait',
    shots: [
      {
        id: 'ask',
        dur: 2.0,
        play: [{clip: 'quick-add', from: 1.5, to: 3.5}],
        from: {ry: -160, rx: 18, rz: -14, lift: -0.5, zoom: 0.85, fy: 0.35},
        moves: [{at: 0, over: 1.5, to: {ry: -14, rx: 5, rz: 1, lift: 0, zoom: 1.25, fy: 0.3}, ease: 'settle'}],
        title: 'Just say what you spent.',
      },
      {
        id: 'draft',
        dur: 3.6,
        play: [{clip: 'quick-add', from: 11.0, to: 13.8}],
        from: {ry: 28, rx: 4, zoom: 1.1, fy: 0.4},
        moves: [
          {at: 0, over: 0.8, to: {ry: 10}, ease: 'settle'},
          {at: 0.5, over: 2.6, to: {zoom: 1.95, fy: 0.42, ry: 4}, ease: 'glide'},
        ],
        title: 'Moni drafts it.',
      },
      {
        id: 'approve',
        dur: 1.8,
        play: [{clip: 'quick-add', from: 18.8, to: 20.4}],
        from: {ry: -18, zoom: 1.6, fy: 0.72},
        moves: [{at: 0, over: 1.6, to: {ry: -6, zoom: 1.45, fy: 0.76}, ease: 'glide'}],
        title: 'You approve.',
      },
      endShot('quick-add', 21.0),
    ],
  },
  {
    id: 'SpotScan',
    out: 'spot-scan.mp4',
    layout: 'portrait',
    shots: [
      {
        id: 'chooser',
        dur: 1.6,
        play: [{clip: 'scan-receipt', from: 1.4, to: 2.8}],
        from: {ry: -160, rx: 18, rz: -14, lift: -0.5, zoom: 0.9, fy: 0.55},
        moves: [{at: 0, over: 1.3, to: {ry: -14, rx: 5, rz: 1, lift: 0, zoom: 1.3, fy: 0.62}, ease: 'settle'}],
        title: 'Snap the receipt.',
      },
      {
        id: 'read',
        dur: 1.9,
        play: [
          {clip: 'scan-receipt', from: 12.45, to: 13.0},
          {clip: 'scan-receipt', from: 14.8, to: 15.9},
        ],
        from: {ry: 24, rx: 4, zoom: 1.3, fy: 0.35},
        moves: [{at: 0, over: 1.8, to: {ry: 8, zoom: 2.0, fy: 0.2}, ease: 'glide'}],
        title: 'Moni reads every line.',
      },
      {
        id: 'added',
        dur: 1.8,
        play: [{clip: 'scan-receipt', from: 15.95, to: 17.6}],
        from: {ry: -16, zoom: 1.5, fy: 0.55},
        moves: [{at: 0, over: 1.7, to: {ry: -4, zoom: 1.2, fy: 0.5}, ease: 'glide'}],
        title: 'One tap, and it counts.',
      },
      endShot('scan-receipt', 18.0),
    ],
  },
  {
    id: 'SpotReview',
    out: 'spot-review.mp4',
    layout: 'portrait',
    shots: [
      {
        id: 'grab',
        dur: 2.6,
        play: [{clip: 'review-captures', from: 0.0, to: 2.6}],
        from: {ry: -160, rx: 18, rz: -14, lift: -0.5, zoom: 0.9, fy: 0.45},
        moves: [{at: 0, over: 1.5, to: {ry: -12, rx: 5, rz: 1, lift: 0, zoom: 1.3, fy: 0.42}, ease: 'settle'}],
        title: 'Payments, caught.',
      },
      {
        id: 'sort',
        dur: 2.2,
        play: [{clip: 'review-captures', from: 7.4, to: 9.6}],
        from: {ry: 26, zoom: 1.25, fy: 0.45},
        moves: [{at: 0, over: 2.0, to: {ry: 8, zoom: 1.45, fy: 0.44}, ease: 'glide'}],
        title: 'Swipe to sort.',
      },
      {
        id: 'caught-up',
        dur: 1.8,
        play: [{clip: 'review-captures', from: 12.1, to: 13.9}],
        from: {ry: -20, zoom: 1.25, fy: 0.35},
        moves: [{at: 0, over: 1.6, to: {ry: -6, zoom: 1.45, fy: 0.3}, ease: 'glide'}],
        title: 'Done in seconds.',
      },
      endShot('review-captures', 14.5),
    ],
  },
];
