import {useEffect, useState} from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {NoReactInternals} from 'remotion/no-react';
import {cream, creamDeep, deepMint, fontReady, ink, useBrandFont} from '../../brand';
import {poseAt, sourceAt} from '../../film/timeline';
import type {Layout} from '../../film/types';
import type {EditorialCut, EditorialShot, EndCard, Side} from './shots';

const muted = '#6B665C';
const FONT = 'Funnel Display';
const TRACK = -0.035;

type Box = {x: number; y: number; w: number; h: number};

/** Every position in the frame, per layout. `panel` is the picture panel when the phone sits on the right; the left side mirrors it. */
const GRID: Record<
  Layout,
  {
    W: number;
    H: number;
    phoneH: number;
    panel: Box;
    type: Box;
    aside: Box | null;
    headlineMax: number;
    echoMax: number;
    subSize: number;
    endMax: number;
  }
> = {
  portrait: {
    W: 1080,
    H: 1920,
    phoneH: 1040,
    panel: {x: 480, y: 780, w: 600, h: 1140},
    type: {x: 72, y: 150, w: 936, h: 600},
    aside: {x: 72, y: 830, w: 360, h: 1000},
    headlineMax: 150,
    echoMax: 230,
    subSize: 46,
    endMax: 190,
  },
  landscape: {
    W: 1920,
    H: 1080,
    phoneH: 900,
    panel: {x: 1120, y: 0, w: 800, h: 1080},
    type: {x: 130, y: 0, w: 860, h: 1080},
    aside: null,
    headlineMax: 132,
    echoMax: 230,
    subSize: 44,
    endMax: 210,
  },
};

const mirror = (b: Box, W: number, side: Side, flip: boolean): Box => (side === 'right' !== flip ? b : {...b, x: W - b.x - b.w});

let ctx: CanvasRenderingContext2D | null = null;
const widthAt100 = (text: string, weight: number) => {
  ctx ??= document.createElement('canvas').getContext('2d');
  if (!ctx) return text.length * 55;
  ctx.font = `${weight} 100px "${FONT}"`;
  return ctx.measureText(text).width + TRACK * 100 * text.length;
};

/** The largest size up to `max` at which every line fits in `width`; all lines share it. */
const fit = (lines: string[], width: number, max: number, weight: number) =>
  Math.min(max, ...lines.map((l) => (width / widthAt100(l, weight)) * 100 * 0.98));

const useFontLoaded = () => {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    fontReady.then(() => setOk(true));
  }, []);
  return ok;
};

const ease = (frame: number, fps: number, frames = 18) => spring({frame, fps, config: {damping: 200}, durationInFrames: frames});

/** Lines that rise word by word out of a mask. */
const MaskedLines = ({lines, size, weight, color, elapsed, stagger}: {lines: string[]; size: number; weight: number; color: string; elapsed: number; stagger: number}) => {
  const {fps} = useVideoConfig();
  let n = 0;
  return (
    <div style={{display: 'flex', flexDirection: 'column'}}>
      {lines.map((line, li) => (
        <div key={li} style={{overflow: 'hidden', paddingBottom: size * 0.14, marginBottom: -size * 0.14, lineHeight: 1.02}}>
          {line.split(' ').map((word, wi) => {
            const p = ease(elapsed - stagger * n++, fps, 20);
            return (
              <span
                key={wi}
                style={{
                  display: 'inline-block',
                  whiteSpace: 'pre',
                  fontSize: size,
                  fontWeight: weight,
                  letterSpacing: `${TRACK}em`,
                  color,
                  transform: `translateY(${(1 - p) * 110}%)`,
                }}
              >
                {wi > 0 ? ' ' : ''}
                {word}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const Rule = ({elapsed}: {elapsed: number}) => {
  const {fps} = useVideoConfig();
  const p = ease(elapsed, fps, 22);
  return <div style={{width: 112 * p, height: 10, borderRadius: 5, backgroundColor: deepMint}} />;
};

const Folio = ({n, total, elapsed}: {n: number; total: number; elapsed: number}) => {
  const {fps} = useVideoConfig();
  const p = ease(elapsed, fps);
  const pad = (k: number) => String(k).padStart(2, '0');
  return (
    <div
      style={{
        alignSelf: 'flex-start',
        padding: '10px 24px 12px',
        borderRadius: 999,
        backgroundColor: deepMint,
        color: cream,
        fontSize: 30,
        fontWeight: 600,
        letterSpacing: '0.02em',
        opacity: p,
        transform: `translateY(${(1 - p) * 16}px)`,
      }}
    >
      {pad(n)} / {pad(total)}
    </div>
  );
};

const frameUrl = (clip: string, time: number) =>
  NoReactInternals.getOffthreadVideoSource({
    src: staticFile(`clips/${clip}.mp4`),
    currentTime: Math.round(time * 60) / 60,
    transparent: false,
    toneMapped: true,
  });

const PhonePanel = ({shot, local, layout}: {shot: EditorialShot; local: number; layout: Layout}) => {
  const frame = useCurrentFrame();
  const g = GRID[layout];
  const panel = mirror(g.panel, g.W, shot.side, false);
  const pose = poseAt(shot, local);
  const src = sourceAt(shot.play, local);
  const H = g.phoneH;
  const W = H * (1080 / 2400);
  const bezel = Math.round(H * 0.012);
  const enter = interpolate(local, [0, 0.7], [0, 1], {extrapolateRight: 'clamp', easing: (t) => 1 - (1 - t) ** 3});
  const ry = pose.ry + Math.sin(frame / 70) * 0.8;
  const rx = pose.rx + 1.5 + Math.sin(frame / 90) * 0.5;
  const drift = Math.sin(frame / 80) * 6 + (1 - enter) * 40 + pose.lift * H;
  const ox = (pose.fx - 0.5) * W;
  const oy = (pose.fy - 0.5) * H;
  const inner = layout === 'portrait' ? 56 : 64;
  const radius = shot.side === 'right' ? `${inner}px 0 0 ${layout === 'portrait' ? 0 : inner}px` : `0 ${inner}px ${layout === 'portrait' ? 0 : inner}px 0`;
  const inset = layout === 'landscape' ? 64 : 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: panel.x,
        top: panel.y + inset,
        width: panel.w,
        height: panel.h - inset * 2,
        backgroundColor: creamDeep,
        borderRadius: radius,
        overflow: 'hidden',
        perspective: 2800,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: panel.w / 2 - W / 2 - bezel,
          top: (panel.h - inset * 2) / 2 - H / 2 - bezel + drift,
          width: W + bezel * 2,
          height: H + bezel * 2,
          borderRadius: W * 0.13,
          backgroundColor: ink,
          boxShadow: '0 40px 90px rgba(23,24,26,0.16), 0 8px 24px rgba(23,24,26,0.10)',
          transformOrigin: `${W / 2 + bezel + ox}px ${H / 2 + bezel + oy}px`,
          transform: `rotateY(${ry}deg) rotateX(${rx}deg) scale(${pose.zoom})`,
        }}
      >
        <div style={{position: 'absolute', left: bezel, top: bezel, width: W, height: H, borderRadius: W * 0.105, overflow: 'hidden', backgroundColor: '#000'}}>
          <Img src={frameUrl(src.clip, src.time)} style={{width: W, height: H, display: 'block'}} />
        </div>
      </div>
    </div>
  );
};

const ShotType = ({shot, local, index, total, layout}: {shot: EditorialShot; local: number; index: number; total: number; layout: Layout}) => {
  const {fps} = useVideoConfig();
  const g = GRID[layout];
  const type = mirror(g.type, g.W, shot.side, layout === 'portrait');
  const f = local * fps;
  const head = fit(shot.lines, type.w, g.headlineMax, 650);
  const echo = shot.echo ? fit([shot.echo.text], type.w, g.echoMax, 700) : 0;
  const out = interpolate((shot.dur - local) * fps, [0, 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const leave = {opacity: out, transform: `translateY(${(1 - out) * -24 - local * 4}px)`};
  const words = shot.lines.join(' ').split(' ').length;
  const subStart = 6 + words * 3 + 6;

  const sub = shot.sub ? (
    <SubLine text={shot.sub} size={g.subSize} start={subStart} f={f} />
  ) : null;

  if (layout === 'portrait') {
    const aside = mirror(g.aside!, g.W, shot.side, false);
    return (
      <>
        <div style={{position: 'absolute', left: type.x, top: type.y, width: type.w, display: 'flex', flexDirection: 'column', gap: 30, ...leave}}>
          <Rule elapsed={f - 2} />
          <MaskedLines lines={shot.lines} size={head} weight={650} color={ink} elapsed={f - 6} stagger={3} />
          {shot.echo ? <MaskedLines lines={[shot.echo.text]} size={echo} weight={700} color={deepMint} elapsed={f - shot.echo.at * fps} stagger={0} /> : null}
        </div>
        <div style={{position: 'absolute', left: aside.x, top: aside.y, width: aside.w, height: aside.h, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', ...leave}}>
          <Folio n={index + 1} total={total} elapsed={f - 8} />
          {sub}
        </div>
      </>
    );
  }

  return (
    <div style={{position: 'absolute', left: type.x, top: 0, width: type.w, height: g.H, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 34, ...leave}}>
      <Folio n={index + 1} total={total} elapsed={f - 8} />
      <MaskedLines lines={shot.lines} size={head} weight={650} color={ink} elapsed={f - 6} stagger={3} />
      {shot.echo ? (
        <div style={{height: echo * 1.04}}>
          <MaskedLines lines={[shot.echo.text]} size={echo} weight={700} color={deepMint} elapsed={f - shot.echo.at * fps} stagger={0} />
        </div>
      ) : null}
      <Rule elapsed={f - subStart} />
      {sub}
    </div>
  );
};

const SubLine = ({text, size, start, f}: {text: string; size: number; start: number; f: number}) => {
  const {fps} = useVideoConfig();
  const p = ease(f - start, fps);
  return (
    <div style={{fontSize: size, fontWeight: 500, color: muted, letterSpacing: '-0.01em', lineHeight: 1.2, opacity: p, transform: `translateY(${(1 - p) * 20}px)`}}>
      {text}
    </div>
  );
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

const End = ({card, local, layout}: {card: EndCard; local: number; layout: Layout}) => {
  const {fps} = useVideoConfig();
  const g = GRID[layout];
  const f = local * fps;
  const portrait = layout === 'portrait';
  const x = portrait ? 72 : 160;
  const width = portrait ? 936 : 1200;
  const size = fit(card.lines, width, g.endMax, 650);
  const mark = ease(f - 14, fps, 22);
  return (
    <div style={{position: 'absolute', left: x, top: 0, width, height: g.H, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: portrait ? 44 : 40}}>
      <Rule elapsed={f - 2} />
      <MaskedLines lines={card.lines} size={size} weight={650} color={ink} elapsed={f - 4} stagger={4} />
      <SubLine text={card.sub} size={portrait ? 46 : 48} start={18} f={f} />
      <div style={{display: 'flex', alignItems: 'center', gap: 26, marginTop: portrait ? 60 : 36, opacity: mark, transform: `translateY(${(1 - mark) * 20}px)`}}>
        <Img src={staticFile('moni-icon.svg')} style={{width: portrait ? 112 : 104, height: portrait ? 112 : 104}} />
        <Wordmark size={portrait ? 84 : 78} />
      </div>
    </div>
  );
};

export const EditorialFilm = ({cut, layout}: {cut: EditorialCut; layout: Layout}) => {
  useBrandFont();
  const loaded = useFontLoaded();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  let start = 0;
  const index = cut.shots.findIndex((s) => {
    if (t < start + s.dur) return true;
    start += s.dur;
    return false;
  });
  const local = t - start;
  const shot = index >= 0 ? cut.shots[index] : null;
  return (
    <AbsoluteFill style={{backgroundColor: cream, fontFamily: FONT}}>
      {shot ? <PhonePanel key={`p${index}`} shot={shot} local={local} layout={layout} /> : null}
      {loaded && shot ? <ShotType key={`t${index}`} shot={shot} local={local} index={index} total={cut.shots.length} layout={layout} /> : null}
      {loaded && !shot ? <End card={cut.end} local={local} layout={layout} /> : null}
    </AbsoluteFill>
  );
};
