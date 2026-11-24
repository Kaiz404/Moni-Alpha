export type ClipId =
  | 'home-overview'
  | 'spend-pace'
  | 'quick-add'
  | 'scan-receipt'
  | 'review-captures'
  | 'ask-moni'
  | 'budget-categories'
  | 'bills'
  | 'spend-calendar'
  | 'debts'
  | 'places-map'
  | 'activity-search';

/** A stretch of a clip in source seconds, played at `speed`. The last segment's final frame holds until the shot ends. */
export type Segment = {clip: ClipId; from: number; to: number; speed?: number};

/** Angles in degrees. `zoom` 1 fits the whole phone in the stage. `fx`/`fy` pick the screen point the camera centres on, 0 to 1 from the top left. `lift` raises the phone in phone heights. */
export type Pose = {ry: number; rx: number; rz: number; zoom: number; fx: number; fy: number; lift: number};

export type Ease = 'glide' | 'settle' | 'whip' | 'drift';

/** From `at` seconds into the shot, move to `to` over `over` seconds. */
export type Move = {at: number; over: number; to: Partial<Pose>; ease?: Ease};

export type Shot = {
  id: string;
  dur: number;
  play: Segment[];
  from: Partial<Pose>;
  moves: Move[];
  title?: string;
  sub?: string;
  end?: boolean;
};

export type Layout = 'portrait' | 'landscape';

export type Video = {id: string; out: string; layout: Layout; shots: Shot[]};
