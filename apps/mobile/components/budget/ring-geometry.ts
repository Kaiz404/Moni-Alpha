export type RingOptions = {
  /** Centre line of the stroke. */
  radius: number;
  strokeWidth: number;
  /** Clear space between the round ends of two neighbours, at their closest. */
  gap: number;
  /** The smallest arc keeps this many degrees between its cap centres, so it reads as a capsule. */
  minSweep: number;
  /** Past this count the smallest values share one last arc. */
  maxSegments: number;
};

export type RingSegment = {
  /** The inputs this arc stands for; more than one means the grouped remainder. */
  indexes: number[];
  value: number;
  /** Of the total, 0 to 1. */
  share: number;
  /** Clockwise from 12 o'clock, in degrees, between the cap centres. */
  start: number;
  sweep: number;
};

const TURN = 360;

const degrees = (radians: number) => (radians * 180) / Math.PI;

/** The angle two points on the centre line span when `chord` apart. */
const chordAngle = (chord: number, radius: number) =>
  degrees(2 * Math.asin(Math.min(1, chord / (2 * radius))));

/** Each value gets its share of `room`, never under `floor`; those above the floor pay for it. */
function shareOut(values: readonly number[], room: number, floor: number): number[] {
  const floored = new Set<number>();
  for (;;) {
    const free = values.flatMap((value, index) => (floored.has(index) ? [] : [{ value, index }]));
    const left = room - floored.size * floor;
    const sum = free.reduce((total, item) => total + item.value, 0);
    const under = free.filter((item) => (item.value / sum) * left < floor);
    if (!under.length)
      return values.map((value, index) => (floored.has(index) ? floor : (value / sum) * left));
    for (const item of under) floored.add(item.index);
  }
}

/**
 * Lays values round a ring of separate round-capped arcs, biggest first from 12 o'clock.
 *
 * A round cap reaches half a stroke past its arc's end, so what the eye reads as an arc's length
 * is its sweep plus one stroke's worth of angle. That visible length is what follows the share.
 * Neighbours sit a fixed chord apart, which keeps the gaps equal whatever their sizes, and one
 * value leaves the same gap between its own two ends.
 */
export function ringSegments(values: readonly number[], options: RingOptions): RingSegment[] {
  const { radius, strokeWidth, gap, minSweep, maxSegments } = options;
  const pitch = chordAngle(strokeWidth + gap, radius);
  const cap = chordAngle(strokeWidth, radius);
  const limit = Math.min(maxSegments, Math.max(1, Math.floor(TURN / (pitch + minSweep))));

  const ranked = values
    .map((value, index) => ({ value, index }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value || a.index - b.index);
  if (!ranked.length) return [];

  const total = ranked.reduce((sum, item) => sum + item.value, 0);
  const named = ranked.length > limit ? ranked.slice(0, limit - 1) : ranked;
  const rest = ranked.slice(named.length);
  const groups = named.map((item) => ({ value: item.value, indexes: [item.index] }));
  if (rest.length)
    groups.push({
      value: rest.reduce((sum, item) => sum + item.value, 0),
      indexes: rest.map((item) => item.index),
    });

  const visible = shareOut(
    groups.map((group) => group.value),
    TURN - groups.length * (pitch - cap),
    minSweep + cap,
  );
  let start = pitch / 2;
  return groups.map((group, index) => {
    const sweep = visible[index] - cap;
    const segment = { ...group, share: group.value / total, start, sweep };
    start += sweep + pitch;
    return segment;
  });
}

export type RingHit = { kind: 'segment'; index: number } | { kind: 'centre' };

/**
 * What a tap at (x, y) from the ring's centre lands on. The whole band belongs to the arcs, a tap
 * in a gap going to the nearer neighbour, so there is no dead spot between them. Null is outside.
 */
export function ringHit(
  segments: readonly Pick<RingSegment, 'start' | 'sweep'>[],
  x: number,
  y: number,
  { radius, strokeWidth, slop }: { radius: number; strokeWidth: number; slop: number },
): RingHit | null {
  const distance = Math.hypot(x, y);
  if (distance < radius - strokeWidth / 2 - slop) return { kind: 'centre' };
  if (distance > radius + strokeWidth / 2 + slop || !segments.length) return null;
  const angle = (degrees(Math.atan2(x, -y)) + TURN) % TURN;
  const away = (segment: Pick<RingSegment, 'start' | 'sweep'>) => {
    const along = (angle - segment.start + TURN) % TURN;
    return along <= segment.sweep ? 0 : Math.min(along - segment.sweep, TURN - along);
  };
  let nearest = 0;
  segments.forEach((segment, index) => {
    if (away(segment) < away(segments[nearest])) nearest = index;
  });
  return { kind: 'segment', index: nearest };
}

/** A point on the ring, for the icon at the middle of an arc. */
export function ringPoint(centre: number, radius: number, angle: number) {
  'worklet';
  const radians = (angle * Math.PI) / 180;
  return { x: centre + radius * Math.sin(radians), y: centre - radius * Math.cos(radians) };
}

/** The SVG path of an arc's centre line; stroke it with round caps. */
export function arcPath(centre: number, radius: number, start: number, sweep: number) {
  'worklet';
  const from = ringPoint(centre, radius, start);
  const to = ringPoint(centre, radius, start + sweep);
  return `M${from.x.toFixed(2)} ${from.y.toFixed(2)}A${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
}
