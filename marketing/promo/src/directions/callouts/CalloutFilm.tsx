import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {NoReactInternals} from 'remotion/no-react';
import {cream, deepMint, ink, useBrandFont} from '../../brand';
import type {Segment} from '../../film/types';
import type {Callout, Cut, Layout, Shot} from './shots';

const STAGE: Record<
  Layout,
  {phoneH: number; phoneTop: number; shift: number; margin: number; gap: number; safeTop: number; safeBottom: number; title: number; sub: number}
> = {
  portrait: {phoneH: 1240, phoneTop: 140, shift: 120, margin: 44, gap: 40, safeTop: 60, safeBottom: 1400, title: 80, sub: 40},
  landscape: {phoneH: 960, phoneTop: 60, shift: 390, margin: 110, gap: 130, safeTop: 70, safeBottom: 1010, title: 76, sub: 38},
};

const SCREEN_ASPECT = 1080 / 2400;
const CAPTION_ROOM = 200;

type Rect = {x: number; y: number; w: number; h: number};

const easeIn = Easing.bezier(0.2, 0, 0, 1);
const easeOut = Easing.bezier(0.4, 0, 0.2, 1);
const glide = Easing.bezier(0.45, 0, 0.2, 1);

const phoneGeometry = (layout: Layout) => {
  const s = STAGE[layout];
  const bezel = s.phoneH * 0.018;
  const screenH = s.phoneH - 2 * bezel;
  const screenW = screenH * SCREEN_ASPECT;
  return {bezel, screenH, screenW, phoneW: screenW + 2 * bezel, phoneH: s.phoneH, top: s.phoneTop};
};

const frameUrl = (seg: {clip: string; time: number}) =>
  NoReactInternals.getOffthreadVideoSource({
    src: staticFile(`clips/${seg.clip}.mp4`),
    currentTime: Math.round(seg.time * 60) / 60,
    transparent: false,
    toneMapped: true,
  });

const sourceAt = (play: Segment[], local: number) => {
  let t = local;
  for (const seg of play) {
    const len = (seg.to - seg.from) / (seg.speed ?? 1);
    if (t < len) return {clip: seg.clip, time: seg.from + t * (seg.speed ?? 1)};
    t -= len;
  }
  const last = play[play.length - 1];
  return {clip: last.clip, time: last.to};
};

const locate = (shots: Shot[], t: number) => {
  let start = 0;
  for (let i = 0; i < shots.length; i++) {
    if (t < start + shots[i].dur || i === shots.length - 1) return {index: i, shot: shots[i], local: t - start};
    start += shots[i].dur;
  }
  throw new Error('no shots');
};

const sideSign = (shot: Shot) => (shot.side === 'right' ? -1 : shot.side === 'left' ? 1 : 0);

/** How far the callout is lifted out, 0 on the screen to 1 at its card position. */
const lifted = (c: Callout, local: number) => {
  const inn = interpolate(local, [c.at, c.at + 0.6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeIn});
  const out = interpolate(local, [c.at + c.dur - 0.5, c.at + c.dur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut});
  return inn * (1 - out);
};

const placeCard = (layout: Layout, width: number, height: number, side: Shot['side'], src: Rect, phone: Rect, c: Callout): Rect => {
  const s = STAGE[layout];
  const right = side !== 'left';
  if (layout === 'portrait') {
    const w = Math.min(c.crop.w * phone.w * c.zoom, width - 2 * s.margin);
    const h = (w / (c.crop.w * phone.w)) * src.h;
    const x = right ? width - s.margin - w : s.margin;
    const above = src.y - s.gap - h;
    const below = src.y + src.h + s.gap;
    const wantAbove = c.place ? c.place === 'above' : src.y + src.h / 2 > phone.y + phone.h / 2;
    const y = wantAbove ? Math.max(s.safeTop, above) : Math.min(s.safeBottom - h, below);
    return {x, y, w, h};
  }
  const phoneEdge = right ? phone.x + phone.w + s.gap : phone.x - s.gap;
  const room = right ? width - s.margin - phoneEdge : phoneEdge - s.margin;
  const w = Math.min(c.crop.w * phone.w * c.zoom, room);
  const h = (w / (c.crop.w * phone.w)) * src.h;
  const x = right ? phoneEdge : phoneEdge - w;
  let cy = Math.min(Math.max(src.y + src.h / 2, s.safeTop + h / 2), s.safeBottom - h / 2);
  cy = cy < height / 2 ? Math.min(cy, s.safeBottom - CAPTION_ROOM - h / 2) : Math.max(cy, s.safeTop + CAPTION_ROOM + h / 2);
  return {x, y: cy - h / 2, w, h};
};

const lerpRect = (a: Rect, b: Rect, p: number): Rect => ({x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, w: a.w + (b.w - a.w) * p, h: a.h + (b.h - a.h) * p});

/** Where the connector meets each rect: the facing edges' midpoints. */
const connector = (layout: Layout, src: Rect, card: Rect) => {
  if (layout === 'portrait') {
    const above = card.y + card.h <= src.y + 1;
    return above
      ? {a: {x: src.x + src.w / 2, y: src.y}, b: {x: card.x + card.w / 2, y: card.y + card.h}}
      : {a: {x: src.x + src.w / 2, y: src.y + src.h}, b: {x: card.x + card.w / 2, y: card.y}};
  }
  const right = card.x > src.x;
  return right
    ? {a: {x: src.x + src.w, y: src.y + src.h / 2}, b: {x: card.x, y: card.y + card.h / 2}}
    : {a: {x: src.x, y: src.y + src.h / 2}, b: {x: card.x + card.w, y: card.y + card.h / 2}};
};

const Wordmark = ({size}: {size: number}) => (
  <div style={{display: 'inline-flex', alignItems: 'center', padding: `${size * 0.2}px ${size * 0.55}px ${size * 0.26}px`, borderRadius: 999, backgroundColor: deepMint}}>
    <div style={{display: 'inline-flex', alignItems: 'baseline', fontSize: size, lineHeight: 1, fontWeight: 700, letterSpacing: '-0.035em', color: cream}}>
      <span>mon</span>
      <span style={{position: 'relative', display: 'inline-block'}}>
        ı
        <span
          style={{
            position: 'absolute',
            left: '50%',
            top: size * 0.13,
            width: size * 0.17,
            height: size * 0.17,
            marginLeft: -size * 0.085,
            borderRadius: '50%',
            backgroundColor: '#8ECF9D',
          }}
        />
      </span>
    </div>
  </div>
);

const EndCard = ({local, title, sub, layout}: {local: number; title: string; sub?: string; layout: Layout}) => {
  const rise = (from: number) => {
    const p = interpolate(local, [from, from + 0.6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeIn});
    return {opacity: p, transform: `translateY(${(1 - p) * 24}px)`};
  };
  const big = layout === 'landscape';
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 34}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 28, ...rise(0.35)}}>
        <Img src={staticFile('moni-icon.svg')} style={{width: big ? 150 : 132, height: big ? 150 : 132}} />
        <Wordmark size={big ? 120 : 104} />
      </div>
      <div style={{...rise(0.6), fontSize: big ? 68 : 60, fontWeight: 600, color: ink, letterSpacing: -1.5}}>{title}</div>
      {sub ? <div style={{...rise(0.75), fontSize: big ? 38 : 34, fontWeight: 500, color: '#6B665C', marginTop: -14}}>{sub}</div> : null}
    </AbsoluteFill>
  );
};

export const CalloutFilm = ({cut}: {cut: Cut}) => {
  useBrandFont();
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const {layout, shots} = cut;
  const s = STAGE[layout];
  const g = phoneGeometry(layout);
  const {index, shot, local} = locate(shots, t);

  const prev = shots[Math.max(0, index - 1)];
  const move = index === 0 ? 1 : interpolate(local, [0, 0.8], [0, 1], {extrapolateRight: 'clamp', easing: glide});
  const fromX = sideSign(prev) * s.shift;
  const toX = shot.end ? fromX : sideSign(shot) * s.shift;
  const phoneCx = width / 2 + fromX + (toX - fromX) * move;
  const phone: Rect = {x: phoneCx - g.phoneW / 2, y: g.top, w: g.phoneW, h: g.phoneH};
  const screen: Rect = {x: phone.x + g.bezel, y: phone.y + g.bezel, w: g.screenW, h: g.screenH};

  const intro = index === 0 ? interpolate(local, [0, 0.7], [0, 1], {extrapolateRight: 'clamp', easing: easeIn}) : 1;
  const outro = shot.end ? 1 - interpolate(local, [0, 0.5], [0, 1], {extrapolateRight: 'clamp', easing: easeOut}) : 1;
  const phoneShow = intro * outro;

  const active = shot.callouts.map((c) => ({c, p: lifted(c, local)})).find(({p}) => p > 0);
  const p = active?.p ?? 0;
  const yaw = Math.sin(t * 0.55) * 2.2 * (1 - p);
  const pitch = Math.sin(t * 0.4 + 1) * 1.2 * (1 - p);

  const url = frameUrl(sourceAt(shot.play, local));

  let callout = null;
  let hole: Rect | null = null;
  if (active) {
    const {c} = active;
    const src: Rect = {x: screen.x + c.crop.x * screen.w, y: screen.y + c.crop.y * screen.h, w: c.crop.w * screen.w, h: c.crop.h * screen.h};
    hole = {x: c.crop.x * screen.w, y: c.crop.y * screen.h, w: src.w, h: src.h};
    const target = placeCard(layout, width, height, shot.side, src, screen, c);
    const card = lerpRect(src, target, p);
    const k = card.w / src.w;
    const line = connector(layout, src, target);
    const lineP = interpolate(p, [0.55, 1], [0, 1], {extrapolateLeft: 'clamp'});
    const right = shot.side !== 'left';
    const capP = interpolate(p, [0.4, 1], [0, 1], {extrapolateLeft: 'clamp'});
    const capStyle = {opacity: capP, transform: `translateY(${(1 - capP) * 22}px)`};
    const capBelow = target.y + target.h / 2 < height / 2;
    const caption =
      layout === 'portrait'
        ? {top: g.top + g.phoneH + 110, left: s.margin + 36, right: s.margin + 36, textAlign: right ? ('right' as const) : ('left' as const)}
        : capBelow
          ? {top: target.y + target.h + 48, left: target.x, width: Math.max(target.w, 640), textAlign: 'left' as const}
          : {bottom: height - target.y + 48, left: target.x, width: Math.max(target.w, 640), textAlign: 'left' as const};

    callout = (
      <>
        <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
          <line
            x1={line.a.x}
            y1={line.a.y}
            x2={line.a.x + (line.b.x - line.a.x) * lineP}
            y2={line.a.y + (line.b.y - line.a.y) * lineP}
            stroke={deepMint}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={lineP}
          />
          <circle cx={line.a.x} cy={line.a.y} r={7} fill={deepMint} opacity={lineP} />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: card.x,
            top: card.y,
            width: card.w,
            height: card.h,
            overflow: 'hidden',
            borderRadius: 10 + 18 * p,
            boxShadow: `0 ${30 * p}px ${70 * p}px rgba(52, 40, 18, ${0.24 * p}), 0 ${4 * p}px ${12 * p}px rgba(52, 40, 18, ${0.1 * p})`,
            backgroundColor: cream,
          }}
        >
          <Img
            src={url}
            style={{position: 'absolute', left: -c.crop.x * screen.w * k, top: -c.crop.y * screen.h * k, width: screen.w * k, height: screen.h * k, maxWidth: 'none'}}
          />
        </div>
        <div style={{position: 'absolute', ...caption, ...capStyle}}>
          <div style={{fontSize: s.title, fontWeight: 650, color: ink, letterSpacing: -2.2, lineHeight: 1.04}}>{c.title}</div>
          {c.sub ? <div style={{fontSize: s.sub, fontWeight: 500, color: '#6B665C', letterSpacing: -0.4, lineHeight: 1.2, marginTop: 16}}>{c.sub}</div> : null}
        </div>
      </>
    );
  }

  return (
    <AbsoluteFill style={{backgroundColor: cream, fontFamily: 'Funnel Display'}}>
      <div
        style={{
          position: 'absolute',
          left: phone.x,
          top: phone.y,
          width: phone.w,
          height: phone.h,
          opacity: phoneShow,
          transform: `translateY(${(1 - phoneShow) * 40}px) perspective(2600px) rotateY(${yaw}deg) rotateX(${pitch}deg)`,
          borderRadius: phone.w * 0.13,
          backgroundColor: ink,
          boxShadow: '0 40px 90px rgba(52, 40, 18, 0.20), 0 8px 22px rgba(52, 40, 18, 0.12), inset 0 0 0 2px #2c2e31',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: g.bezel,
            top: g.bezel,
            width: g.screenW,
            height: g.screenH,
            borderRadius: phone.w * 0.13 - g.bezel,
            overflow: 'hidden',
            backgroundColor: cream,
          }}
        >
          <Img src={url} style={{width: '100%', height: '100%'}} />
          {hole ? (
            <div
              style={{
                position: 'absolute',
                left: hole.x,
                top: hole.y,
                width: hole.w,
                height: hole.h,
                borderRadius: 12,
                boxShadow: `inset 0 0 0 3px rgba(35, 107, 71, ${p}), 0 0 0 3000px rgba(23, 24, 26, ${0.3 * p})`,
              }}
            />
          ) : null}
        </div>
      </div>
      {callout}
      {shot.end ? <EndCard local={local} title={shot.end.title} sub={shot.end.sub} layout={layout} /> : null}
    </AbsoluteFill>
  );
};
