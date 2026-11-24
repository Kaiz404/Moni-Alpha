import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {NoReactInternals} from 'remotion/no-react';
import {cream, creamDeep, deepMint, ink, useBrandFont} from '../../brand';
import type {Frame, Shot} from './shots';
import {clipTime, visibleAt} from './timeline';

const SCREEN_ASPECT = 1080 / 2400;

type Layout = {phoneHeight: number; phoneTop: number; label: 'top' | 'left'; labelSize: number};

export const layouts: Record<Frame, Layout & {width: number; height: number}> = {
  portrait: {width: 1080, height: 1350, phoneHeight: 1130, phoneTop: 150, label: 'top', labelSize: 46},
  square: {width: 1080, height: 1080, phoneHeight: 900, phoneTop: 132, label: 'top', labelSize: 40},
  wide: {width: 1920, height: 1080, phoneHeight: 940, phoneTop: 62, label: 'left', labelSize: 64},
};

/** The clip frame at an explicit time, so shots can hold and cut freely. */
const Screen = ({shot, local}: {shot: Shot; local: number}) => (
  <Img
    src={NoReactInternals.getOffthreadVideoSource({
      src: staticFile(`clips/${shot.clip}.mp4`),
      currentTime: Math.round(clipTime(shot, local) * 60) / 60,
      transparent: false,
      toneMapped: true,
    })}
    style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
  />
);

const opacityOf = (local: number, fadeIn: number) =>
  fadeIn === 0
    ? 1
    : interpolate(local, [0, fadeIn], [0, 1], {
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.quad),
      });

/** During a dissolve the old label fades out over the first half and the new one fades in over the second, so two labels never overlap. */
const labelAt = (visible: ReturnType<typeof visibleAt>) => {
  const top = visible[visible.length - 1];
  const below = visible[visible.length - 2];
  const half = top.fadeIn / 2;
  if (!below || top.local >= top.fadeIn || below.shot.label === top.shot.label) return {text: top.shot.label, opacity: 1};
  const shown = top.local < half ? below : top;
  return {text: shown.shot.label, opacity: interpolate(Math.abs(top.local - half), [0, half], [0, 1], {easing: Easing.inOut(Easing.quad)})};
};

const Phone = ({height, children}: {height: number; children: React.ReactNode}) => {
  const bezel = Math.round(height * 0.012);
  const screenH = height - bezel * 2;
  const screenW = Math.round(screenH * SCREEN_ASPECT);
  const width = screenW + bezel * 2;
  const radius = Math.round(width * 0.13);
  const camera = Math.round(screenW * 0.032);
  return (
    <div style={{position: 'relative', width, height}}>
      <div
        style={{
          position: 'absolute',
          left: '8%',
          right: '8%',
          bottom: -height * 0.018,
          height: height * 0.05,
          borderRadius: '50%',
          background: 'rgba(60, 48, 28, 0.32)',
          filter: `blur(${Math.round(height * 0.022)}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          background: '#141517',
          padding: bezel,
          boxShadow: `0 ${height * 0.03}px ${height * 0.06}px rgba(70, 56, 30, 0.18), 0 ${height * 0.008}px ${height * 0.016}px rgba(70, 56, 30, 0.14), inset 0 0 0 ${Math.max(1, Math.round(bezel * 0.18))}px #3a3c40`,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: screenW,
            height: screenH,
            borderRadius: radius - bezel,
            overflow: 'hidden',
            background: cream,
          }}
        >
          {children}
          <div
            style={{
              position: 'absolute',
              top: screenH * 0.011,
              left: (screenW - camera) / 2,
              width: camera,
              height: camera,
              borderRadius: '50%',
              background: '#0b0b0c',
            }}
          />
        </div>
      </div>
    </div>
  );
};

const Label = ({text, opacity, size, align}: {text: string; opacity: number; size: number; align: 'center' | 'left'}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      opacity,
      display: 'flex',
      alignItems: 'center',
      justifyContent: align === 'center' ? 'center' : 'flex-start',
      fontFamily: 'Funnel Display',
      fontWeight: 600,
      fontSize: size,
      letterSpacing: '-0.01em',
      color: ink,
      whiteSpace: align === 'center' ? 'nowrap' : 'normal',
      lineHeight: 1.08,
      textWrap: 'balance',
    }}
  >
    <div>
      {align === 'left' ? <div style={{width: 56, height: 6, borderRadius: 3, background: deepMint, marginBottom: size * 0.5}} /> : null}
      {text}
    </div>
  </div>
);

export const Still = ({frame: kind, shots}: {frame: Frame; shots: Shot[]}) => {
  useBrandFont();
  const frame = useCurrentFrame();
  const layout = layouts[kind];
  const visible = visibleAt(shots, frame);
  const phoneWidth = Math.round((layout.phoneHeight * (1 - 0.024)) * SCREEN_ASPECT + layout.phoneHeight * 0.024);
  const phoneLeft = (layout.width - phoneWidth) / 2;

  const labelBox: React.CSSProperties =
    layout.label === 'top'
      ? {position: 'absolute', left: 0, right: 0, top: 0, height: layout.phoneTop}
      : {position: 'absolute', left: 150, width: phoneLeft - 230, top: 0, bottom: 0};

  return (
    <AbsoluteFill
      style={{background: `radial-gradient(120% 90% at 50% 42%, ${cream} 0%, ${cream} 45%, ${creamDeep} 100%)`}}
    >
      <div style={labelBox}>
        <Label {...labelAt(visible)} size={layout.labelSize} align={layout.label === 'top' ? 'center' : 'left'} />
      </div>
      <div style={{position: 'absolute', left: phoneLeft, top: layout.phoneTop}}>
        <Phone height={layout.phoneHeight}>
          {visible.map((v) => (
            <div key={v.start} style={{position: 'absolute', inset: 0, opacity: opacityOf(v.local, v.fadeIn)}}>
              <Screen shot={v.shot} local={v.local} />
            </div>
          ))}
        </Phone>
      </div>
    </AbsoluteFill>
  );
};
