import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {cream, creamDeep, deepMint, ink, useBrandFont} from '../brand';
import {BODY_H, DEPTH, Phone, SCREEN_H, SCREEN_W} from '../Phone';
import {locate, poseAt, shotStarts, sourceAt} from './timeline';
import type {Layout, Shot, Video} from './types';

const FOV = 32;
const deg = Math.PI / 180;

/** Where the phone stage sits, in normalised device coordinates, and how tall it is as a share of the frame. */
const STAGE: Record<Layout, {cx: number; cy: number; h: number; zoom: number}> = {
  portrait: {cx: 0, cy: 0.2, h: 0.68, zoom: 1},
  landscape: {cx: 0.38, cy: 0, h: 0.86, zoom: 0.68},
};

const Rig = ({shots, layout}: {shots: Shot[]; layout: Layout}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const camera = useThree((s) => s.camera);
  const {shot, local} = locate(shots, frame / fps);
  const pose = poseAt(shot, local);
  const src = sourceAt(shot.play, local);
  const stage = STAGE[layout];

  const ry = pose.ry * deg + Math.sin(frame / 50) * 1.2 * deg;
  const rx = pose.rx * deg + Math.sin(frame / 67) * 0.6 * deg;
  const rz = pose.rz * deg;
  const lift = pose.lift * BODY_H;
  const euler = new THREE.Euler(rx, ry, rz, 'YXZ');
  const focus = new THREE.Vector3((pose.fx - 0.5) * SCREEN_W, (0.5 - pose.fy) * SCREEN_H, DEPTH / 2).applyEuler(euler);
  focus.y += lift;

  const t = Math.tan((FOV / 2) * deg);
  const dist = BODY_H / (2 * stage.h * t) / (pose.zoom * stage.zoom);
  const halfH = t * dist;
  const halfW = halfH * (width / height);
  camera.position.set(focus.x - stage.cx * halfW, focus.y - stage.cy * halfH, focus.z + dist);
  camera.lookAt(camera.position.x, camera.position.y, camera.position.z - 1);

  return (
    <group position={[0, lift, 0]} rotation={euler}>
      <Phone clip={src.clip} time={src.time} />
    </group>
  );
};

type Card = {title?: string; sub?: string; end?: boolean; start: number; end_: number};

/** Consecutive shots with the same caption share one caption, so it does not re-animate on a cut. */
const cards = (shots: Shot[]): Card[] => {
  const {starts} = shotStarts(shots);
  const out: Card[] = [];
  shots.forEach((s, i) => {
    const prev = out[out.length - 1];
    if (prev && !s.end && prev.title === s.title && prev.sub === s.sub) prev.end_ = starts[i] + s.dur;
    else out.push({title: s.title, sub: s.sub, end: s.end, start: starts[i], end_: starts[i] + s.dur});
  });
  return out;
};

const Wordmark = ({size}: {size: number}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: `${size * 0.2}px ${size * 0.55}px ${size * 0.26}px`,
      borderRadius: 999,
      backgroundColor: deepMint,
    }}
  >
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

const CaptionCard = ({card, layout}: {card: Card; layout: Layout}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  if (t < card.start || t >= card.end_) return null;
  const local = (t - card.start) * fps;
  const lead = card.start === 0 ? 8 : 4;
  const inn = spring({frame: local - lead, fps, config: {damping: 200}, durationInFrames: 16});
  const subIn = spring({frame: local - lead - 6, fps, config: {damping: 200}, durationInFrames: 16});
  const out = card.end ? 1 : interpolate((card.end_ - t) * fps, [0, 6], [0, 1], {extrapolateRight: 'clamp'});
  const portrait = layout === 'portrait';
  const lift = (p: number) => ({opacity: p * out, transform: `translateY(${(1 - p) * 28}px)`, filter: `blur(${(1 - p) * 6}px)`});

  if (card.end) {
    const icon = spring({frame: local - 4, fps, config: {damping: 16, stiffness: 110}, durationInFrames: 22});
    const mark = spring({frame: local - 10, fps, config: {damping: 200}, durationInFrames: 18});
    const line = spring({frame: local - 18, fps, config: {damping: 200}, durationInFrames: 18});
    return (
      <div style={{display: 'flex', flexDirection: 'column', alignItems: portrait ? 'center' : 'flex-start', gap: portrait ? 34 : 40}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 28}}>
          <Img src={staticFile('moni-icon.svg')} style={{width: portrait ? 132 : 150, height: portrait ? 132 : 150, opacity: icon, transform: `scale(${0.6 + 0.4 * icon})`}} />
          <div style={lift(mark)}>
            <Wordmark size={portrait ? 104 : 120} />
          </div>
        </div>
        <div style={{...lift(line), fontSize: portrait ? 60 : 68, fontWeight: 600, color: ink, letterSpacing: -1.5}}>{card.title}</div>
        {card.sub ? <div style={{...lift(line), fontSize: portrait ? 34 : 38, fontWeight: 500, color: '#6B665C', marginTop: -14}}>{card.sub}</div> : null}
      </div>
    );
  }

  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: portrait ? 'center' : 'flex-start', textAlign: portrait ? 'center' : 'left', gap: 18}}>
      <div style={{...lift(inn), fontSize: portrait ? 84 : 96, fontWeight: 650, color: ink, letterSpacing: -2.4, lineHeight: 1.04, maxWidth: portrait ? 940 : 760}}>{card.title}</div>
      {card.sub ? <div style={{...lift(subIn), fontSize: portrait ? 40 : 44, fontWeight: 500, color: '#6B665C', letterSpacing: -0.4, lineHeight: 1.2}}>{card.sub}</div> : null}
    </div>
  );
};

export const Film = ({video}: {video: Video}) => {
  useBrandFont();
  const {width, height} = useVideoConfig();
  const portrait = video.layout === 'portrait';
  const glow = portrait ? '50% 38%' : '68% 50%';
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse at ${glow}, #fbf8f1 0%, ${cream} 45%, ${creamDeep} 100%)`, fontFamily: 'Funnel Display'}}>
      <ThreeCanvas width={width} height={height} camera={{fov: FOV, near: 0.05, far: 100, position: [0, 0, 6]}} gl={{antialias: true}}>
        <ambientLight intensity={1.4} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} />
        <directionalLight position={[-4, -1, 2]} intensity={0.8} />
        <Rig shots={video.shots} layout={video.layout} />
      </ThreeCanvas>
      <AbsoluteFill
        style={{
          background: portrait
            ? `linear-gradient(to bottom, rgba(246,242,233,0) 66%, rgba(246,242,233,0.94) 76%, ${cream} 100%)`
            : `linear-gradient(to right, ${cream} 0%, rgba(246,242,233,0.94) 38%, rgba(246,242,233,0) 50%)`,
        }}
      />
      <AbsoluteFill
        style={
          portrait
            ? {justifyContent: 'flex-start', alignItems: 'center', paddingTop: 1585}
            : {justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 150}
        }
      >
        {cards(video.shots).map((c, i) => (
          <CaptionCard key={i} card={c} layout={video.layout} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
