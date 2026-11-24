export type Box = { x: number; y: number; width: number; height: number };
/** The photo's pan and zoom, drawn as `translate(x, y) scale(scale)` from its top left corner. */
export type View = { scale: number; x: number; y: number };

export const RESTING: View = { scale: 1, x: 0, y: 0 };
export const MAX_ZOOM = 4;
export const CLICK_ZOOM = 2.5;

export const viewTransform = (view: View) => `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;

/** The transform that puts the full-screen photo over the thumbnail it opens from, so it can grow out of it and shrink back. */
export function flipFrom(from: Box, to: Box): string {
  if (to.width === 0 || to.height === 0) return 'none';
  const scale = Math.min(from.width / to.width, from.height / to.height);
  const x = from.x + from.width / 2 - (to.x + (to.width * scale) / 2);
  const y = from.y + from.height / 2 - (to.y + (to.height * scale) / 2);
  return `translate(${x}px, ${y}px) scale(${scale})`;
}

/** The largest size the photo takes inside the space, keeping its shape; a small photo grows to fill it too. */
export function containSize(space: { width: number; height: number }, natural: { width: number; height: number }) {
  if (natural.width === 0 || natural.height === 0) return { width: 0, height: 0 };
  const scale = Math.min(space.width / natural.width, space.height / natural.height);
  return { width: Math.round(natural.width * scale), height: Math.round(natural.height * scale) };
}

/** Zooms to `scale` about a point on the photo's box (top left 0, 0), so the point under the pointer stays put. */
export function zoomAbout(view: View, point: { x: number; y: number }, scale: number): View {
  const next = Math.min(MAX_ZOOM, Math.max(1, scale));
  if (next === 1) return RESTING;
  const ratio = next / view.scale;
  return { scale: next, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio };
}

/** A click zooms in on the point clicked, and out again when the photo is already zoomed. */
export const clickZoom = (view: View, point: { x: number; y: number }): View => (view.scale > 1 ? RESTING : zoomAbout(view, point, CLICK_ZOOM));

/** A wheel turn up zooms in and down zooms out, by a step that follows how far it turned. */
export const wheelZoom = (view: View, point: { x: number; y: number }, deltaY: number): View => zoomAbout(view, point, view.scale * Math.exp(-deltaY / 300));
