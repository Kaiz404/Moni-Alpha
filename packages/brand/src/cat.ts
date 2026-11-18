/**
 * Cat Pebble, locked: the Moni mascot, app icon and wordmark. Everything is drawn on a 240-unit grid
 * and returned as inline SVG or HTML strings. Deep mint cat holding a Lemon coin at its chest; no
 * tail, no sparkles, and the cat never goes inside the wordmark.
 *
 * Ported from the Python art module, byte for byte: numbers print as Python printed them (`f` for
 * one-decimal values, `py` where Python printed a float as it was).
 */

// ---------------------------------------------------------------- palette
export const CREAM = '#F6F2E9'; // app ground
export const PAPER = '#FFFDF8'; // cards, cat body on dark grounds
export const SAND = '#ECE5D6';
export const HAIRLINE = '#DDD5C5';
export const INK = '#17181A'; // eyes, text
export const INK2 = '#4A463E';
export const META = '#6B665C';
export const DEEP = '#236B47'; // Deep mint: brand tile, cat body on cream
export const MINTKEY = '#8ECF9D'; // Mint key: i-dot on dark grounds
export const PEACH = '#F5BE98'; // inner ears
export const LEMON = '#F7CF3A'; // the coin
export const DARK = '#0B0A09'; // dark-mode ground
export const DARK_TEXT = '#F6F3ED';

// ---------------------------------------------------------------- grounds
/** tile: tile fill. body: cat. eye: eyes. cut: slot and paw keylines (always the ground colour). */
export type Ground = {
  readonly tile?: string | null;
  readonly body: string;
  readonly eye: string;
  readonly cut: string;
};

export const GROUNDS = {
  deep: { tile: DEEP, body: PAPER, eye: INK, cut: DEEP },
  cream: { tile: CREAM, body: DEEP, eye: PAPER, cut: CREAM },
  ink: { tile: INK, body: PAPER, eye: INK, cut: INK },
  none: { tile: null, body: DEEP, eye: PAPER, cut: CREAM }, // mascot on a cream/paper page
  dark: { tile: null, body: PAPER, eye: INK, cut: DARK }, // mascot on a dark page
} as const satisfies Record<string, Ground>;

export type GroundName = keyof typeof GROUNDS;

// ---------------------------------------------------------------- geometry (240 grid)
type Point = readonly [number, number];

export const BODY =
  'M120 60 C 168 60 196 98 196 142 C 196 180 168 198 120 198 C 72 198 44 180 44 142 C 44 98 72 60 120 60 Z';
/** Base, tip, base of the left ear; the right ear is mirrored. */
export const EAR: readonly [Point, Point, Point] = [
  [51, 112],
  [55, 38],
  [102, 68],
];
export const EAR_TIP_R = 11;
/** The ear tip swings around this point; the base never moves. */
export const EAR_PIVOT: Point = [80, 92];
/** Extra base point buried deep in the head. */
export const EAR_ROOT: Point = [92, 112];
/** x, y, w, h; radius h/2. */
export const SLOT = [103, 76, 34, 10] as const;
/** Eyes are 12 × 28 pills, raised to make room for the coin. */
export const EYE_L = 106;
export const EYE_R = 134;
export const EYE_Y = 131;
export const EYE_W = 12;
export const EYE_H = 28;
/** Held at the chest, its bottom just past the body. */
export const COIN = { cx: 120, cy: 178, r: 22 } as const;
/** Two paws wrap the coin's lower sides. */
export const PAW = { dx: 21, dy: 8, rx: 10, ry: 14 } as const;
/** Paws lean in toward the coin. */
export const PAW_ROT = 14;
/** Paw keyline in the ground colour. */
export const PAW_KEY = 4;
export const COIN_RIM = 2.5;
/** Scale from the base centre (120, 198), then lift. */
export const FIT = 0.94;
export const LIFT = -6;

export const TILE_RADIUS = 0.22;

/** Python's `f'{v:.1f}'.rstrip('0').rstrip('.')`: one decimal, a tie to the even digit, no trailing zero. */
function f(v: number) {
  const tie = Number.isInteger(v * 4) && !Number.isInteger(v * 2);
  let s: string;
  if (tie) {
    const low = Math.floor(Math.abs(v) * 10);
    s = `${v < 0 ? '-' : ''}${((low % 2 === 0 ? low : low + 1) / 10).toFixed(1)}`;
  } else {
    s = `${Object.is(v, -0) ? '-' : ''}${v.toFixed(1)}`;
  }
  return s.replace(/0+$/, '').replace(/\.$/, '');
}

/** Python's `str()` of a float: a whole number keeps its `.0`. */
function py(v: number) {
  return Number.isInteger(v) ? v.toFixed(1) : String(v);
}

function pill(cx: number, cy: number, w: number, h: number, fill: string, rot = 0) {
  const t = rot ? ` transform="rotate(${rot} ${f(cx)} ${f(cy)})"` : '';
  return `<rect x="${f(cx - w / 2)}" y="${f(cy - h / 2)}" width="${f(w)}" height="${f(h)}" rx="${f(w / 2)}" fill="${fill}"${t}></rect>`;
}

export type EyeKind = 'pill' | 'look' | 'arc' | 'closed' | 'worried' | 'round' | 'squeeze';

function eyes(kind: EyeKind, ink: string, dx = 0, dy = 0) {
  const L = EYE_L + dx;
  const R = EYE_R + dx;
  const Y = EYE_Y + dy;
  switch (kind) {
    case 'pill':
      return pill(L, Y, EYE_W, EYE_H, ink) + pill(R, Y, EYE_W, EYE_H, ink);
    case 'look':
      return pill(L, Y, EYE_W, 24, ink) + pill(R, Y, EYE_W, 24, ink);
    case 'arc':
      return [L, R]
        .map(
          (x) =>
            `<path d="M${x - 9} ${Y + 5} Q${x} ${Y - 13} ${x + 9} ${Y + 5}" fill="none" stroke="${ink}" stroke-width="7" stroke-linecap="round"></path>`,
        )
        .join('');
    case 'closed':
      return [L, R]
        .map(
          (x) =>
            `<path d="M${x - 9} ${Y + 2} Q${x} ${Y + 9} ${x + 9} ${Y + 2}" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round"></path>`,
        )
        .join('');
    case 'worried':
      return pill(L - 2, Y + 2, EYE_W, 22, ink, -14) + pill(R + 2, Y + 2, EYE_W, 22, ink, 14);
    case 'round':
      return `<circle cx="${L - 2}" cy="${Y}" r="10" fill="${ink}"></circle><circle cx="${R + 2}" cy="${Y}" r="10" fill="${ink}"></circle>`;
    case 'squeeze':
      return (
        [
          [L, 1],
          [R, -1],
        ] as const
      )
        .map(
          ([x, k]) =>
            `<path d="M${x - 8 * k} ${Y - 8} L${x + 7 * k} ${Y} L${x - 8 * k} ${Y + 8}" fill="none" stroke="${ink}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"></path>`,
        )
        .join('');
  }
}

/** A triangle from base a over tip t to base b, with the tip rounded at radius r. */
function roundedTriangle(a: Point, t: Point, b: Point, r: number) {
  const toward = (p: Point, q: Point, d: number): Point => {
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const n = (dx * dx + dy * dy) ** 0.5;
    return [p[0] + (dx / n) * d, p[1] + (dy / n) * d];
  };
  const p1 = toward(t, a, r);
  const p2 = toward(t, b, r);
  return `M${f(a[0])} ${f(a[1])} L${f(p1[0])} ${f(p1[1])} Q${f(t[0])} ${f(t[1])} ${f(p2[0])} ${f(p2[1])} L${f(b[0])} ${f(b[1])} Z`;
}

/** The ear tip after a droop (degrees, + is down and out). Only the tip moves, so the base stays buried. */
function earTip(droop: number): Point {
  const t = EAR[1];
  const th = -droop * (Math.PI / 180);
  const x = t[0] - EAR_PIVOT[0];
  const y = t[1] - EAR_PIVOT[1];
  return [
    EAR_PIVOT[0] + x * Math.cos(th) - y * Math.sin(th),
    EAR_PIVOT[1] + x * Math.sin(th) + y * Math.cos(th),
  ];
}

/** The ear's closing chain, all inside the body outline at every droop. */
export function earBase(): Point[] {
  return [EAR[0], EAR_ROOT, EAR[2]];
}

function earPath(droop: number) {
  const d = roundedTriangle(EAR[0], earTip(droop), EAR[2], EAR_TIP_R).slice(0, -2);
  return `${d} L${EAR_ROOT[0]} ${EAR_ROOT[1]} Z`;
}

function innerEar(droop: number, k = 0.46, lift = 0.34, r = 5) {
  const a = EAR[0];
  const t = earTip(droop);
  const b = EAR[2];
  const c: Point = [(a[0] + t[0] + b[0]) / 3, (a[1] + t[1] + b[1]) / 3];
  const sh: Point = [(t[0] - c[0]) * lift, (t[1] - c[1]) * lift];
  const shrink = (p: Point): Point => [
    c[0] + (p[0] - c[0]) * k + sh[0],
    c[1] + (p[1] - c[1]) * k + sh[1],
  ];
  return roundedTriangle(shrink(a), shrink(t), shrink(b), r);
}

/** The left-side part, already posed, and its mirror. */
function pair(s: string) {
  return `${s}<g transform="translate(240 0) scale(-1 1)">${s}</g>`;
}

function coin(cx: number, cy: number, r: number) {
  return (
    `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${LEMON}" stroke="${INK}" stroke-width="${COIN_RIM}"></circle>` +
    `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.6)}" fill="none" stroke="${INK}" stroke-width="2" opacity="0.35"></circle>`
  );
}

function paw(cx: number, cy: number, body: string, cut: string, rot: number) {
  const t = rot ? ` transform="rotate(${rot} ${f(cx)} ${f(cy)})"` : '';
  return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${PAW.rx}" ry="${PAW.ry}" fill="${body}" stroke="${cut}" stroke-width="${PAW_KEY}" paint-order="stroke"${t}></ellipse>`;
}

// ---------------------------------------------------------------- moods
type Triple = readonly [number, number, number];

/**
 * body: rot (degrees about the base centre), sx, sy (squash), dy (hop). eyes: e (kind), ex, ey.
 * ear: droop in degrees (+ is down and out). coin: cx, cy, r; paws: cx, cy, rot each, or the
 * default hug.
 */
export type MoodSpec = {
  readonly rot: number;
  readonly sx: number;
  readonly sy: number;
  readonly dy: number;
  readonly e: EyeKind | null;
  readonly ex: number;
  readonly ey: number;
  readonly ear: number;
  readonly coin?: Triple;
  readonly paws?: readonly Triple[];
  readonly paw_dx?: number;
};

export const MOODS = [
  'neutral',
  'happy',
  'thinking',
  'listening',
  'worried',
  'sleepy',
  'celebrate',
  'surprised',
  'hidden',
] as const;

export type Mood = (typeof MOODS)[number];

export const MOOD_SPEC: Record<Mood, MoodSpec> = {
  neutral: { rot: 0, sx: 1, sy: 1, dy: 0, e: 'pill', ex: 0, ey: 0, ear: 0 },
  happy: {
    rot: -4,
    sx: 1.02,
    sy: 1,
    dy: -4,
    e: 'arc',
    ex: 0,
    ey: -2,
    ear: -6,
    coin: [120, 172, 22],
  },
  thinking: {
    rot: 5,
    sx: 1,
    sy: 1,
    dy: 0,
    e: 'look',
    ex: 8,
    ey: -8,
    ear: 6,
    coin: [120, 180, 22],
  },
  listening: {
    rot: -4,
    sx: 0.98,
    sy: 1.02,
    dy: 0,
    e: 'look',
    ex: -6,
    ey: -4,
    ear: -12,
    coin: [174, 118, 18],
    paws: [
      [160, 134, 30],
      [190, 130, -20],
    ],
  },
  worried: {
    rot: 0,
    sx: 1.06,
    sy: 0.93,
    dy: 0,
    e: 'worried',
    ex: 0,
    ey: 2,
    ear: 20,
    coin: [120, 182, 20],
    paw_dx: 15,
  },
  sleepy: {
    rot: 0,
    sx: 1.1,
    sy: 0.86,
    dy: 0,
    e: 'closed',
    ex: 0,
    ey: 4,
    ear: 10,
    coin: [120, 184, 22],
  },
  celebrate: {
    rot: 0,
    sx: 0.96,
    sy: 1.05,
    dy: -6,
    e: 'arc',
    ex: 0,
    ey: -2,
    ear: -12,
    coin: [120, 42, 19],
    paws: [
      [100, 50, 0],
      [140, 50, 0],
    ],
  },
  surprised: {
    rot: 0,
    sx: 0.94,
    sy: 1.07,
    dy: 0,
    e: 'round',
    ex: 0,
    ey: -4,
    ear: -14,
    coin: [120, 40, 18],
    paws: [
      [97, 184, -24],
      [143, 184, 24],
    ],
  },
  hidden: {
    rot: 0,
    sx: 1.03,
    sy: 0.97,
    dy: 0,
    e: null,
    ex: 0,
    ey: 0,
    ear: 22,
    coin: [120, 134, 25],
    paws: [
      [93, 148, 0],
      [147, 148, 0],
    ],
  },
};

export const MOOD_NOTES: Record<Mood, string> = {
  neutral: 'Home. Pill eyes, ears up, paws hugging the coin at the chest.',
  happy: 'Under budget. Arc eyes, a small tilt, coin lifted a little.',
  thinking: 'Reading a receipt. Eyes up and right, head tilts, coin held low.',
  listening: 'Voice capture. Coin held up to the right ear, ears perked, eyes up.',
  worried: 'Over budget. Tilted eyes, body squashes, ears droop, paws hug the coin tighter.',
  sleepy: 'No activity. Closed eyes, loaf squash, ears relaxed, coin resting low.',
  celebrate: 'Debt settled. Hops up, arc eyes, coin raised over the head.',
  surprised:
    'Big spend. Round eyes, body stretches, the coin pops out of the paws and over the head.',
  hidden: 'Amounts hidden. Ears flat, the coin held up over the eyes.',
};

/** Where the figure sits: scale from the base centre, then lift. Defaults fit the app-icon tile. */
export type Pose = { readonly fit?: number; readonly lift?: number };

function posed(m: MoodSpec, fit: number, lift: number) {
  const [cx, cy, r] = m.coin ?? [COIN.cx, COIN.cy, COIN.r];
  const pdx = m.paw_dx ?? PAW.dx;
  const paws: readonly Triple[] = m.paws?.length
    ? m.paws
    : [
        [cx - pdx, cy + PAW.dy, PAW_ROT],
        [cx + pdx, cy + PAW.dy, -PAW_ROT],
      ];
  const transform =
    `translate(0 ${m.dy + lift}) rotate(${m.rot} 120 198) translate(120 198) ` +
    `scale(${f(m.sx * fit)} ${f(m.sy * fit)}) translate(-120 -198)`;
  return { cx, cy, r, paws, transform };
}

function slot(fill: string) {
  const [x, y, w, h] = SLOT;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${py(h / 2)}" fill="${fill}"></rect>`;
}

/** The cat as an SVG `<g>` on the 240 grid, with no tile. */
export function figure(
  mood: Mood = 'neutral',
  ground: GroundName | Ground = 'deep',
  { fit = FIT, lift = LIFT }: Pose = {},
) {
  const g = typeof ground === 'string' ? GROUNDS[ground] : ground;
  const m = MOOD_SPEC[mood];
  const { cx, cy, r, paws, transform } = posed(m, fit, lift);
  let s = pair(`<path d="${earPath(m.ear)}" fill="${g.body}"></path>`);
  s += `<path d="${BODY}" fill="${g.body}"></path>`;
  s += pair(`<path d="${innerEar(m.ear)}" fill="${PEACH}"></path>`);
  s += slot(g.cut);
  if (m.e) s += eyes(m.e, g.eye, m.ex, m.ey);
  s += coin(cx, cy, r);
  s += paws.map(([px, py, pr]) => paw(px, py, g.body, g.cut, pr)).join('');
  return `<g transform="${transform}">${s}</g>`;
}

const label = (text?: string) => (text ? `role="img" aria-label="${text}"` : 'aria-hidden="true"');

export type CatSvgOptions = {
  readonly size?: number;
  readonly ground?: GroundName;
  readonly tile?: boolean;
  /** Kept for API stability; the art uses no ids. */
  readonly idPrefix?: string;
  readonly label?: string;
};

/**
 * Inline `<svg>`. `tile` draws the app-icon tile (radius 22%). Without it, a transparent mascot cropped
 * to the figure: use ground `none` on light pages or `dark` on dark pages.
 */
export function catSvg(
  mood: Mood = 'neutral',
  { size = 180, ground = 'deep', tile = true, idPrefix = 'x', label: text }: CatSvgOptions = {},
) {
  const g: Ground = GROUNDS[ground];
  if (tile) {
    return (
      `<svg width="${size}" height="${size}" viewBox="0 0 240 240" ${label(text)} data-id="${idPrefix}" style="display: block; flex: none">` +
      `<rect width="240" height="240" rx="${f(240 * TILE_RADIUS)}" fill="${g.tile || DEEP}"></rect>${figure(mood, ground)}</svg>`
    );
  }
  // Room for drooped ears; ears, body and coin at fit 1.
  const vb = mood === 'celebrate' || mood === 'surprised' ? [24, 10, 192, 198] : [24, 22, 192, 186];
  const w = (size * vb[2]!) / vb[3]!;
  return (
    `<svg width="${f(w)}" height="${size}" viewBox="${vb.join(' ')}" ${label(text)} data-id="${idPrefix}" style="display: block; flex: none; overflow: visible">` +
    `${figure(mood, ground, { fit: 1.0, lift: 0 })}</svg>`
  );
}

// ---------------------------------------------------------------- wordmark and lockups
export const FONT_LINK =
  '<link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300..800&amp;display=swap" rel="stylesheet">';

export type WordmarkOptions = {
  readonly color?: string;
  /** The drawn round i-dot (Deep mint by default); without it, a plain i in the word colour. */
  readonly dot?: boolean;
  readonly dotColor?: string;
};

/** "moni" in Funnel Display Bold, lowercase, tracking −3.5%, as HTML (the word is live text). */
export function wordmarkHtml(
  size: number,
  { color = INK, dot = true, dotColor }: WordmarkOptions = {},
) {
  let tail = '<span>i</span>';
  if (dot) {
    const d = size * 0.17;
    tail =
      `<span style="position: relative; display: inline-block">ı<span style="position: absolute; left: 50%; top: ${f(size * 0.13)}px; ` +
      `width: ${f(d)}px; height: ${f(d)}px; margin-left: ${f(-d / 2)}px; border-radius: 50%; background: ${dotColor || DEEP}"></span></span>`;
  }
  return (
    `<div style="display: inline-flex; align-items: baseline; font-family: 'Funnel Display', system-ui, sans-serif; font-size: ${f(size)}px; line-height: 1; font-weight: 700; letter-spacing: -0.035em; color: ${color}; flex: none">` +
    `<span>mon</span>${tail}</div>`
  );
}

/** Lockup ratios of the tile height H. */
export const LOCKUP = {
  h_word: 0.84,
  h_gap: 0.3,
  h_nudge: -0.06,
  s_word: 0.44,
  s_gap: 0.16,
  clear: 0.25,
  min_tile: 24,
} as const;

export type LockupOptions = {
  /** The tile height H. */
  readonly size?: number;
  /** The page behind the lockup. The icon tile is always Deep mint. */
  readonly ground?: 'cream' | 'dark';
  readonly dot?: boolean;
};

/** The app-icon tile with the wordmark beside it or under it, as HTML. */
export function lockupHtml(
  kind: 'horizontal' | 'stacked' = 'horizontal',
  { size = 80, ground = 'cream', dot = true }: LockupOptions = {},
) {
  const light = ground !== 'dark';
  const word = { color: light ? INK : DARK_TEXT, dot, dotColor: light ? DEEP : MINTKEY };
  const icon = catSvg('neutral', { size, ground: 'deep', tile: true, label: 'Moni' });
  if (kind === 'horizontal') {
    return (
      `<div style="display: inline-flex; align-items: center; gap: ${f(size * LOCKUP.h_gap)}px">${icon}` +
      `<div style="transform: translateY(${f(size * LOCKUP.h_nudge)}px)">${wordmarkHtml(size * LOCKUP.h_word, word)}</div></div>`
    );
  }
  return (
    `<div style="display: inline-flex; flex-direction: column; align-items: center; gap: ${f(size * LOCKUP.s_gap)}px">${icon}` +
    `${wordmarkHtml(size * LOCKUP.s_word, word)}</div>`
  );
}

// ---------------------------------------------------------------- one-colour (mono) mark
// One fill, true transparent knock-outs drawn as an SVG mask, so the cut-outs show whatever sits
// behind. Silhouette = body + ears. Cut: slot, eyes, a gap around the coin, a ring inside the coin,
// a gap around each paw.

/** 240-grid units. paws: 'behind' | 'front' | 'none'. */
export type MonoSpec = {
  readonly coin_gap: number;
  readonly ring: number;
  readonly ring_w: number;
  readonly paw_gap: number;
  readonly paws: 'behind' | 'front' | 'none';
};

export const MONO: MonoSpec = { coin_gap: 7, ring: 0.48, ring_w: 8, paw_gap: 7, paws: 'behind' };
/** Square crops for an untiled mono cat. */
export const MONO_VB = { tall: [21, 10, 198, 198], std: [24, 19, 192, 192] } as const;
/** Default tile: light for a dark cat, dark for a light cat. */
export const MONO_TILE = ['#D3E4D4', '#2B3A30'] as const;
let monoIds = 0;

function isDark(hex: string) {
  let h = hex.replace(/^#+/, '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

export type MonoPose = Pose & {
  /** Overrides MONO, for construction studies only; boards never pass it. */
  readonly spec?: Partial<MonoSpec>;
};

/** The one-colour cat on the 240 grid: a `<mask>` and one filled rect. maskId must be unique on the page. */
export function monoFigure(
  mood: Mood = 'neutral',
  color = INK,
  maskId = 'mono',
  { fit = FIT, lift = LIFT, spec }: MonoPose = {},
) {
  const k = { ...MONO, ...spec };
  const m = MOOD_SPEC[mood];
  const W = '#FFFFFF';
  const B = '#000000';
  const { cx, cy, r, paws, transform } = posed(m, fit, lift);
  let s =
    pair(`<path d="${earPath(m.ear)}" fill="${W}"></path>`) +
    `<path d="${BODY}" fill="${W}"></path>`;
  s += slot(B);
  if (m.e) s += eyes(m.e, B, m.ex, m.ey);
  let disc =
    `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r + k.coin_gap)}" fill="${B}"></circle>` +
    `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${W}"></circle>`;
  if (k.ring) {
    disc += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * k.ring)}" fill="none" stroke="${B}" stroke-width="${f(k.ring_w)}"></circle>`;
  }
  let pw = '';
  for (const [px, py, pr] of k.paws === 'none' ? [] : paws) {
    const t = pr ? ` transform="rotate(${pr} ${f(px)} ${f(py)})"` : '';
    if (k.paw_gap) {
      pw += `<ellipse cx="${f(px)}" cy="${f(py)}" rx="${PAW.rx}" ry="${PAW.ry}" fill="${B}" stroke="${B}" stroke-width="${f(2 * k.paw_gap)}"${t}></ellipse>`;
    }
    pw += `<ellipse cx="${f(px)}" cy="${f(py)}" rx="${PAW.rx}" ry="${PAW.ry}" fill="${W}"${t}></ellipse>`;
  }
  s += k.paws === 'behind' ? pw + disc : disc + pw;
  return (
    `<g transform="${transform}"><mask id="${maskId}" maskUnits="userSpaceOnUse" x="-40" y="-40" width="320" height="320">${s}</mask>` +
    `<rect x="-40" y="-40" width="320" height="320" fill="${color}" mask="url(#${maskId})"></rect></g>`
  );
}

export type CatMonoSvgOptions = {
  readonly size?: number;
  readonly color?: string;
  readonly idPrefix?: string;
  readonly label?: string;
  /** A themed-icon tile behind the cat: a rounded square (radius 22%) or 'round' for a circle. */
  readonly tile?: boolean | 'round';
  readonly tileColor?: string;
  readonly spec?: Partial<MonoSpec>;
  /** The mask id; by default `<idPrefix>-mono<n>`, numbered per process. */
  readonly maskId?: string;
};

/**
 * The official one-colour cat: one fill, every cut-out transparent. Untiled, it is square and cropped
 * to the cat, for small icons, stamps and print.
 */
export function catMonoSvg(
  mood: Mood = 'neutral',
  {
    size = 96,
    color = INK,
    idPrefix = 'm',
    label: text,
    tile = false,
    tileColor,
    spec,
    maskId,
  }: CatMonoSvgOptions = {},
) {
  monoIds += 1;
  const mid = maskId ?? `${idPrefix}-mono${monoIds}`;
  if (tile) {
    const tc = tileColor || MONO_TILE[isDark(color) ? 0 : 1];
    const back =
      tile === 'round'
        ? `<circle cx="120" cy="120" r="120" fill="${tc}"></circle>`
        : `<rect width="240" height="240" rx="${f(240 * TILE_RADIUS)}" fill="${tc}"></rect>`;
    return (
      `<svg width="${size}" height="${size}" viewBox="0 0 240 240" ${label(text)} data-id="${idPrefix}" style="display: block; flex: none">` +
      `${back}${monoFigure(mood, color, mid, { spec })}</svg>`
    );
  }
  const vb = MONO_VB[mood === 'celebrate' || mood === 'surprised' ? 'tall' : 'std'];
  return (
    `<svg width="${size}" height="${size}" viewBox="${vb.join(' ')}" ${label(text)} data-id="${idPrefix}" style="display: block; flex: none; overflow: visible">` +
    `${monoFigure(mood, color, mid, { fit: 1.0, lift: 0, spec })}</svg>`
  );
}
