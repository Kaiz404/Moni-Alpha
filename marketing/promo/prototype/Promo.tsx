import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {AbsoluteFill, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {cream, creamDeep, deepMint, ink, useBrandFont} from './brand';
import {Phone} from './Phone';

const ease = Easing.bezier(0.45, 0, 0.2, 1);
const tween = (frame: number, range: [number, number], out: [number, number]) =>
  interpolate(frame, range, out, {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});

const Rig = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const camera = useThree((s) => s.camera);

  const enter = spring({frame, fps, config: {damping: 18, mass: 1.6, stiffness: 60}, durationInFrames: 85});
  const pushIn = tween(frame, [85, 125], [0, 1]);
  const pullBack = tween(frame, [262, 312], [0, 1]);

  const rotY = interpolate(enter, [0, 1], [Math.PI * 1.15, -0.4]) + 0.4 * pushIn + 0.42 * pullBack;
  const rotX = interpolate(enter, [0, 1], [0.45, 0.1]) - 0.1 * pushIn + 0.16 * pullBack;
  const rotZ = interpolate(enter, [0, 1], [-0.3, 0.05]) - 0.05 * pushIn - 0.06 * pullBack;
  const y = interpolate(enter, [0, 1], [-3.4, 0]);
  const drift = Math.sin(frame / 40) * 0.02;

  const focus =
    tween(frame, [85, 125], [0, 0.3]) +
    tween(frame, [140, 165], [0, -0.75]) +
    tween(frame, [206, 230], [0, 0.85]) -
    0.4 * pullBack;
  const dist = 4.6 - 2.1 * pushIn + 3.2 * pullBack;
  camera.position.set(0.3 * pullBack, focus + 0.1 - 0.1 * pushIn - 0.6 * pullBack, dist);
  camera.lookAt(0, focus - 0.72 * pullBack, 0);

  return (
    <group position={[0, y + drift, 0]} rotation={[rotX, rotY, rotZ]}>
      <Phone src={staticFile('flow.mp4')} />
    </group>
  );
};

const Caption = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const inn = spring({frame: frame - 285, fps, config: {damping: 200}, durationInFrames: 30});
  const mark = spring({frame: frame - 310, fps, config: {damping: 200}, durationInFrames: 30});
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 240, fontFamily: 'Funnel Display'}}>
      <div style={{opacity: inn, transform: `translateY(${(1 - inn) * 40}px)`, fontSize: 84, fontWeight: 600, color: ink, letterSpacing: -2, textAlign: 'center', lineHeight: 1.05}}>
        See where every
        <br />
        ringgit goes.
      </div>
      <div
        style={{
          marginTop: 48,
          opacity: mark,
          transform: `translateY(${(1 - mark) * 30}px)`,
          padding: '14px 44px',
          borderRadius: 999,
          backgroundColor: deepMint,
          color: cream,
          fontSize: 48,
          fontWeight: 700,
          letterSpacing: -0.5,
        }}
      >
        Moni
      </div>
    </AbsoluteFill>
  );
};

export const Promo = () => {
  useBrandFont();
  const {width, height} = useVideoConfig();
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 42%, #fbf8f1 0%, ${cream} 45%, ${creamDeep} 100%)`}}>
      <ThreeCanvas width={width} height={height} camera={{fov: 40, position: [0, 0, 4.6]}} gl={{antialias: true}}>
        <ambientLight intensity={1.4} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} />
        <directionalLight position={[-4, -1, 2]} intensity={0.8} />
        <Rig />
      </ThreeCanvas>
      <Caption />
    </AbsoluteFill>
  );
};
