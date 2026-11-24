import {Easing, interpolate, spring} from 'remotion';
import type {Ease, Pose, Segment, Shot} from './types';

export const REST: Pose = {ry: 0, rx: 0, rz: 0, zoom: 1, fx: 0.5, fy: 0.5, lift: 0};

export const shotStarts = (shots: Shot[]) => {
  const starts: number[] = [];
  let t = 0;
  for (const s of shots) {
    starts.push(t);
    t += s.dur;
  }
  return {starts, total: t};
};

export const locate = (shots: Shot[], t: number) => {
  const {starts} = shotStarts(shots);
  let i = starts.length - 1;
  while (i > 0 && starts[i] > t) i--;
  return {index: i, shot: shots[i], local: t - starts[i]};
};

export const sourceAt = (play: Segment[], local: number) => {
  let t = local;
  for (const seg of play) {
    const len = (seg.to - seg.from) / (seg.speed ?? 1);
    if (t < len) return {clip: seg.clip, time: seg.from + t * (seg.speed ?? 1)};
    t -= len;
  }
  const last = play[play.length - 1];
  return {clip: last.clip, time: last.to};
};

const FPS = 30;

const progress = (ease: Ease, local: number, at: number, over: number) => {
  const frame = (local - at) * FPS;
  const frames = Math.max(1, over * FPS);
  if (frame <= 0) return 0;
  switch (ease) {
    case 'glide':
      return spring({frame, fps: FPS, config: {damping: 200}, durationInFrames: frames});
    case 'settle':
      return spring({frame, fps: FPS, config: {damping: 15, stiffness: 80, mass: 1.1}, durationInFrames: frames});
    case 'whip':
      return interpolate(frame, [0, frames], [0, 1], {extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic)});
    case 'drift':
      return interpolate(frame, [0, frames], [0, 1], {extrapolateRight: 'clamp', easing: Easing.inOut(Easing.sin)});
  }
};

export const poseAt = (shot: Shot, local: number): Pose => {
  const pose: Pose = {...REST, ...shot.from};
  for (const m of shot.moves) {
    const p = progress(m.ease ?? 'glide', local, m.at, m.over);
    for (const k of Object.keys(m.to) as (keyof Pose)[]) {
      pose[k] = pose[k] + ((m.to[k] as number) - pose[k]) * p;
    }
  }
  return pose;
};
