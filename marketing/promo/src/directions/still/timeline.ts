import {FPS} from '../../brand';
import type {Shot} from './shots';

export const DISSOLVE = Math.round(0.4 * FPS);

export type Placed = {shot: Shot; start: number; length: number; fadeIn: number};

const lengthOf = (s: Shot) => Math.round((s.to - s.from + (s.hold ?? 0)) * FPS);
const fadeOf = (s: Shot) => (s.cut ? 0 : DISSOLVE);

/** Lays shots end to end, each overlapping the one before by its dissolve. The first shot's dissolve overlaps the last shot's tail, so the loop closes on itself. */
export const place = (shots: Shot[]) => {
  let at = 0;
  const placed: Placed[] = shots.map((shot) => ({shot, start: 0, length: lengthOf(shot), fadeIn: fadeOf(shot)}));
  placed.forEach((p, i) => {
    p.start = at;
    const next = placed[(i + 1) % placed.length];
    at += p.length - next.fadeIn;
  });
  return {placed, total: at};
};

/** Every shot instance on screen at `frame`, bottom first. Frame 0 shows the first shot after its dissolve, so the loop's first frame is a clean opening screen. */
export const visibleAt = (shots: Shot[], frame: number) => {
  const {placed, total} = place(shots);
  const f = (frame + placed[0].fadeIn) % total;
  return placed
    .flatMap((p) => [p.start - total, p.start].map((start) => ({...p, start, local: f - start})))
    .filter((p) => p.local >= 0 && p.local < p.length)
    .sort((a, b) => a.start - b.start);
};

/** The clip time, in seconds, a shot shows `local` frames after it starts. */
export const clipTime = (shot: Shot, local: number) => Math.min(shot.from + local / FPS, shot.to);

export const totalFrames = (shots: Shot[]) => place(shots).total;
