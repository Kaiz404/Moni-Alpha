import type {ClipId} from '../../film/types';

export type {ClipId};

/** A stretch of a clip in source seconds. `hold` freezes `from` for that many seconds instead of playing. */
export type Segment = {clip: ClipId; from: number; to?: number; speed?: number; hold?: number};

/**
 * The camera, in degrees and screen fractions. The screen point (`fx`, `fy`) sits at frame height `ay`.
 * `zoom` 1 is the phone at its rest height for the layout. `ry` and `rx` are yaw and tilt.
 */
export type Pose = {zoom: number; fx: number; fy: number; ay: number; ry: number; rx: number};

export type Ease = 'ease' | 'drift';

/**
 * Lands on `to` at `land` shot seconds, or at the shot time that plays source second `beat`. A move with no `over` is a cut.
 * `wide` overrides `to` in landscape.
 */
export type Move = {to: Partial<Pose>; wide?: Partial<Pose>; over?: number; ease?: Ease} & ({land: number} | {beat: number});

export type Side = 'left' | 'right';

/** In portrait the caption leaves at `out` so the phone can take the width; in landscape it stays the whole shot. */
export type Caption = {title: string; sub?: string; side: Side; out: number};

export type Enter = {kind: 'slide'; over: number} | {kind: 'cut'};

export type Shot = {
  id: string;
  dur: number;
  play: Segment[];
  enter: Enter;
  /** Where the camera starts. Every shot names it, so no transition inherits a push-in from the shot before. */
  from: Partial<Pose>;
  moves: Move[];
  caption?: Caption;
  end?: {title: string; sub: string; side: Side};
};

export type Layout = 'portrait' | 'landscape';
