import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {NoReactInternals} from 'remotion/no-react';
import {cream, creamDeep, deepMint, ink, useBrandFont} from '../../brand';
import {glide, locate, poseAt, roomAt, slideIn, slideOut, sourceAt, sway} from './timeline';
import type {Layout, Shot, Side} from './types';

const SW = 1080;
const SH = 2400;
const BEZEL = 34;
const RADIUS = 112;
const THICK = 36;
const MUTED = '#6B665C';

/** Rest phone height as a share of frame height, and how far the phone stands aside for a caption. */
const STAGE: Record<Layout, {restH: number; aside: number; capW: number; capPad: number; title: number; sub: number}> = {
  portrait: {restH: 0.74, aside: 0.17, capW: 340, capPad: 64, title: 70, sub: 34},
  landscape: {restH: 0.84, aside: 0.25, capW: 680, capPad: 150, title: 104, sub: 44},
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const Screen = ({shot, local}: {shot: Shot; local: number}) => {
  const src = sourceAt(shot.play, local);
  return (
    <Img
      src={NoReactInternals.getOffthreadVideoSource({
        src: staticFile(`clips/${src.clip}.mp4`),
        currentTime: Math.round(src.time * 60) / 60,
        transparent: false,
        toneMapped: true,
      })}
      style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
    />
  );
};

type Placed = {shots: Shot[]; layout: Layout; index: number; local: number; t: number; dx: number; children: ReactNode};

/** The phone in CSS 3D. The camera's focus point stays pinned to its frame anchor while the phone turns around it. */
const PhoneAt = ({shots, layout, index, local, t, dx, children}: Placed) => {
  const {width, height} = useVideoConfig();
  const stage = STAGE[layout];
  const pose = poseAt(shots, layout, index, local);
  const room = roomAt(shots, layout, index, local);
  const s = sway(t);
  const scale = (pose.zoom * stage.restH * height) / (SH + BEZEL * 2);
  const ax = (0.5 + stage.aside * room) * width + dx;
  const ay = pose.ay * height;
  const body: CSSProperties = {position: 'absolute', left: 0, top: 0, width: SW + BEZEL * 2, height: SH + BEZEL * 2, borderRadius: RADIUS + BEZEL};
  return (
    <AbsoluteFill style={{perspective: 2600 * pose.zoom, perspectiveOrigin: `${ax}px ${ay}px`}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transformOrigin: '0 0',
          transformStyle: 'preserve-3d',
          transform: `translate(${ax}px, ${ay}px) rotateY(${pose.ry + s.ry}deg) rotateX(${pose.rx + s.rx}deg) scale3d(${scale}, ${scale}, ${scale}) translate(${-(BEZEL + pose.fx * SW)}px, ${-(BEZEL + pose.fy * SH)}px)`,
        }}
      >
        <div style={{...body, transform: `translateZ(${-THICK}px)`, backgroundColor: '#0c0d0e', boxShadow: '0 60px 120px rgba(70,58,36,0.22), 0 18px 40px rgba(70,58,36,0.16)'}} />
        <div style={{...body, backgroundColor: ink, boxShadow: 'inset 0 0 0 3px #3a3c40'}}>
          <div style={{position: 'absolute', left: BEZEL, top: BEZEL, width: SW, height: SH, borderRadius: RADIUS, overflow: 'hidden', backgroundColor: cream}}>{children}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Phones = ({shots, layout, t}: {shots: Shot[]; layout: Layout; t: number}) => {
  const {width} = useVideoConfig();
  const {index, local} = locate(shots, t);
  const shot = shots[index];
  const prev = shots[index - 1];
  const enter = shot.enter;

  if (prev && enter.kind === 'slide' && local < enter.over) {
    const p = glide(local / enter.over);
    const out = poseAt(shots, layout, index - 1, prev.dur + local).zoom;
    const travel = (w: number) => width * (0.55 + 0.6 * w);
    return (
      <>
        <PhoneAt shots={shots} layout={layout} index={index - 1} local={prev.dur + local} t={t} dx={-p * travel(out)}>
          <Screen shot={prev} local={prev.dur + local} />
        </PhoneAt>
        <PhoneAt shots={shots} layout={layout} index={index} local={local} t={t} dx={(1 - p) * travel(poseAt(shots, layout, index, local).zoom)}>
          <Screen shot={shot} local={local} />
        </PhoneAt>
      </>
    );
  }

  return (
    <PhoneAt shots={shots} layout={layout} index={index} local={local} t={t} dx={0}>
      <Screen shot={shot} local={local} />
    </PhoneAt>
  );
};

/** 0 off its edge, 1 in place. */
const presence = (local: number, inAt: number, outAt: number) =>
  slideIn(clamp01((local - inAt) / 0.75)) * (1 - slideOut(clamp01((local - outAt) / 0.5)));

const sideBox = (layout: Layout, side: Side, width: number): CSSProperties => {
  const st = STAGE[layout];
  if (layout === 'portrait') return side === 'left' ? {left: st.capPad, width: st.capW} : {left: width - st.capPad - st.capW, width: st.capW};
  return {left: side === 'left' ? st.capPad : width / 2 + st.capPad * 0.6, width: st.capW};
};

const Caption = ({shots, layout, t}: {shots: Shot[]; layout: Layout; t: number}) => {
  const {width} = useVideoConfig();
  const {index, local} = locate(shots, t);
  const shot = shots[index];
  const cap = shot.caption;
  if (!cap) return null;
  const st = STAGE[layout];
  const portrait = layout === 'portrait';
  const inAt = (shot.enter.kind === 'slide' ? shot.enter.over * 0.7 : 0) + (portrait ? 0.05 : 0.15);
  const outAt = portrait ? cap.out : shot.dur - 0.55;
  const p = presence(local, inAt, outAt);
  const pSub = presence(local, inAt + 0.12, outAt - 0.06);
  const box = sideBox(layout, cap.side, width);
  const off = (q: number) => (cap.side === 'left' ? -1 : 1) * (1 - q) * ((box.width as number) + st.capPad + 40);
  const align = portrait ? cap.side : 'left';
  return (
    <div style={{position: 'absolute', top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: align, gap: portrait ? 20 : 26, ...box}}>
      <div style={{transform: `translateX(${off(p)}px)`, fontSize: st.title, fontWeight: 650, color: ink, letterSpacing: '-0.03em', lineHeight: 1.02}}>{cap.title}</div>
      {cap.sub ? <div style={{transform: `translateX(${off(pSub)}px)`, fontSize: st.sub, fontWeight: 500, color: MUTED, letterSpacing: '-0.01em', lineHeight: 1.2}}>{cap.sub}</div> : null}
    </div>
  );
};

const Wordmark = ({size}: {size: number}) => (
  <div style={{display: 'inline-flex', alignItems: 'center', padding: `${size * 0.2}px ${size * 0.55}px ${size * 0.26}px`, borderRadius: 999, backgroundColor: deepMint}}>
    <div style={{display: 'inline-flex', alignItems: 'baseline', fontSize: size, lineHeight: 1, fontWeight: 700, letterSpacing: '-0.035em', color: cream}}>
      <span>mon</span>
      <span style={{position: 'relative', display: 'inline-block'}}>
        ı
        <span style={{position: 'absolute', left: '50%', top: size * 0.13, width: size * 0.17, height: size * 0.17, marginLeft: -size * 0.085, borderRadius: '50%', backgroundColor: '#8ECF9D'}} />
      </span>
    </div>
  </div>
);

const EndLockup = ({shots, layout, t}: {shots: Shot[]; layout: Layout; t: number}) => {
  const {width, height} = useVideoConfig();
  const {index, local} = locate(shots, t);
  const end = shots[index].end;
  if (!end) return null;
  const portrait = layout === 'portrait';
  const rise = (at: number) => {
    const q = slideIn(clamp01((local - at) / 0.8));
    return {opacity: interpolate(q, [0, 0.4], [0, 1], {extrapolateRight: 'clamp'}), transform: `translateY(${(1 - q) * 30}px)`};
  };
  const box: CSSProperties = portrait
    ? {left: 0, width, top: height * 0.645, alignItems: 'center', textAlign: 'center'}
    : {...sideBox(layout, end.side, width), top: 0, bottom: 0, justifyContent: 'center', alignItems: 'flex-start'};
  return (
    <div style={{position: 'absolute', display: 'flex', flexDirection: 'column', gap: portrait ? 30 : 36, ...box}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 26, ...rise(0.7)}}>
        <Img src={staticFile('moni-icon.svg')} style={{width: portrait ? 120 : 140, height: portrait ? 120 : 140}} />
        <Wordmark size={portrait ? 96 : 112} />
      </div>
      <div style={{fontSize: portrait ? 64 : 76, fontWeight: 650, color: ink, letterSpacing: '-0.03em', ...rise(1.0)}}>{end.title}</div>
      <div style={{fontSize: portrait ? 34 : 40, fontWeight: 500, color: MUTED, marginTop: -12, ...rise(1.15)}}>{end.sub}</div>
    </div>
  );
};

export const CalmFilm = ({shots, layout}: {shots: Shot[]; layout: Layout}) => {
  useBrandFont();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse 120% 90% at 50% 45%, #faf7f0 0%, ${cream} 55%, ${creamDeep} 100%)`, fontFamily: 'Funnel Display', overflow: 'hidden'}}>
      <Phones shots={shots} layout={layout} t={t} />
      <Caption shots={shots} layout={layout} t={t} />
      <EndLockup shots={shots} layout={layout} t={t} />
    </AbsoluteFill>
  );
};
