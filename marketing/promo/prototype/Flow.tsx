import {useBrandFont} from './brand';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {cream, ink} from './brand';

const SLIDE = 18;
const TO_CATEGORY = 135;
const TAP = 190;
const TO_FOOD = 205;

const slide = (frame: number, start: number) =>
  interpolate(frame, [start, start + SLIDE], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.32, 0.72, 0, 1),
  });

const Screen = ({src, x}: {src: string; x: number}) => (
  <AbsoluteFill style={{transform: `translateX(${x * 100}%)`, backgroundColor: cream}}>
    <Img src={staticFile(src)} style={{width: '100%', height: '100%'}} />
  </AbsoluteFill>
);

const StatusBar = () => (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 66,
      backgroundColor: cream,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 38px',
      fontFamily: 'Funnel Display',
      fontWeight: 600,
      fontSize: 26,
      color: ink,
    }}
  >
    <span>9:41</span>
    <span style={{display: 'flex', gap: 8, alignItems: 'center'}}>
      <span style={{width: 34, height: 16, borderRadius: 5, border: `2px solid ${ink}`, padding: 2}}>
        <span style={{display: 'block', width: '80%', height: '100%', borderRadius: 2, backgroundColor: ink}} />
      </span>
    </span>
  </div>
);

export const Flow = () => {
  useBrandFont();
  const frame = useCurrentFrame();
  const a = slide(frame, TO_CATEGORY);
  const b = slide(frame, TO_FOOD);
  const tap = interpolate(frame, [TAP, TAP + 6, TAP + 16], [0, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: cream, overflow: 'hidden'}}>
      <Screen src="1-home.png" x={-a * 0.3} />
      <Screen src="2-by-category.png" x={1 - a - b * 0.3} />
      <div
        style={{
          position: 'absolute',
          left: 32,
          right: 32,
          top: 1018,
          height: 116,
          borderRadius: 40,
          backgroundColor: ink,
          opacity: tap * 0.08 * (1 - b),
          transform: `translateX(${(1 - a - b * 0.3) * 720}px)`,
        }}
      />
      <Screen src="3-food.png" x={1 - b} />
      <StatusBar />
    </AbsoluteFill>
  );
};
