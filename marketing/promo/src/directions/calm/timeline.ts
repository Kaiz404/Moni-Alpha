import {Easing} from 'remotion';
import type {Ease, Layout, Move, Pose, Segment, Shot, Side} from './types';

export const MAX_YAW = 8;
export const MAX_TILT = 4;
const SWAY_YAW = 0.5;
const SWAY_TILT = 0.3;

export const REST: Pose = {zoom: 1, fx: 0.5, fy: 0.5, ay: 0.5, ry: 0, rx: 0};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const EASES: Record<Ease, (x: number) => number> = {
  ease: Easing.bezier(0.45, 0, 0.15, 1),
  drift: Easing.inOut(Easing.sin),
};
export const slideIn = Easing.bezier(0.16, 1, 0.3, 1);
export const slideOut = Easing.bezier(0.5, 0, 0.75, 0);
export const glide = Easing.inOut(Easing.cubic);

export const starts = (shots: Shot[]) => {
  const out: number[] = [];
  let t = 0;
  for (const s of shots) {
    out.push(t);
    t += s.dur;
  }
  return {starts: out, total: t};
};

export const locate = (shots: Shot[], t: number) => {
  const {starts: s} = starts(shots);
  let i = s.length - 1;
  while (i > 0 && s[i] > t) i--;
  return {index: i, local: t - s[i]};
};

const segLen = (seg: Segment) => seg.hold ?? ((seg.to ?? seg.from) - seg.from) / (seg.speed ?? 1);

/** The source frame a shot shows at `local` seconds. Past the last segment the final frame holds. */
export const sourceAt = (play: Segment[], local: number) => {
  let t = Math.max(0, local);
  for (const seg of play) {
    const len = segLen(seg);
    if (t < len) return {clip: seg.clip, time: seg.hold ? seg.from : seg.from + t * (seg.speed ?? 1)};
    t -= len;
  }
  const last = play[play.length - 1];
  return {clip: last.clip, time: last.hold ? last.from : (last.to ?? last.from)};
};

/** The shot time at which a played segment reaches source second `beat`. */
export const beatLocal = (play: Segment[], beat: number) => {
  let t = 0;
  for (const seg of play) {
    const to = seg.to ?? seg.from;
    if (!seg.hold && beat >= seg.from && beat <= to) return t + (beat - seg.from) / (seg.speed ?? 1);
    t += segLen(seg);
  }
  throw new Error(`beat ${beat} is not in any played segment`);
};

const landOf = (shot: Shot, m: Move) => ('land' in m ? m.land : beatLocal(shot.play, m.beat));

const applyMoves = (shot: Shot, layout: Layout, base: Pose, local: number): Pose => {
  const pose = {...base};
  for (const m of shot.moves) {
    const land = landOf(shot, m);
    const over = m.over ?? 0;
    const p = over === 0 ? (local >= land ? 1 : 0) : EASES[m.ease ?? 'ease'](clamp01((local - (land - over)) / over));
    const to = layout === 'landscape' ? {...m.to, ...m.wide} : m.to;
    for (const k of Object.keys(to) as (keyof Pose)[]) pose[k] = pose[k] + ((to[k] as number) - pose[k]) * p;
  }
  return pose;
};

export const poseAt = (shots: Shot[], layout: Layout, index: number, local: number): Pose =>
  applyMoves(shots[index], layout, {...REST, ...shots[index].from}, local);

/** Slow idle breathing, small enough that the yaw and tilt limits still hold. */
export const sway = (t: number) => ({ry: Math.sin(t * 0.55) * SWAY_YAW, rx: Math.sin(t * 0.37 + 1) * SWAY_TILT});

const sideSign = (side: Side) => (side === 'left' ? 1 : -1);

/**
 * How far the phone stands aside for the caption, as a signed share of full room.
 * Positive pushes the phone right (caption on the left).
 */
export const roomAt = (shots: Shot[], layout: Layout, index: number, local: number): number => {
  const shot = shots[index];
  const side = shot.caption?.side ?? shot.end?.side;
  if (layout === 'landscape') {
    return side ? sideSign(side) : 0;
  }
  if (!shot.caption) return 0;
  const sign = sideSign(shot.caption.side);
  const inn = slideIn(clamp01((local - 0.05) / 0.8));
  const out = EASES.ease(clamp01((local - shot.caption.out) / 1.0));
  return sign * inn * (1 - out);
};

/** Fails the render when any shot asks for more yaw or tilt than the direction allows. */
export const checkCalm = (shots: Shot[]) => {
  for (const s of shots) {
    for (const p of [s.from, ...s.moves.flatMap((m) => [m.to, m.wide ?? {}])]) {
      if (p.ry !== undefined && Math.abs(p.ry) + SWAY_YAW > MAX_YAW) throw new Error(`${s.id}: yaw ${p.ry} over ${MAX_YAW}`);
      if (p.rx !== undefined && Math.abs(p.rx) + SWAY_TILT > MAX_TILT) throw new Error(`${s.id}: tilt ${p.rx} over ${MAX_TILT}`);
    }
  }
  return shots;
};
