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
