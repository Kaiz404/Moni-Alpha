/** A single 2D pixel coordinate. */
export type Point = { x: number; y: number };

/** Four corners of a detected document, ordered [topLeft, topRight, bottomRight, bottomLeft]. */
export type Quad = [Point, Point, Point, Point];

export type ProcessResult = { ok: true; uri: string } | { ok: false; reason: string };

/** Minimum accepted contour area as a fraction of the analyzed frame's area (scale-independent). */
export const MIN_CONTOUR_AREA_RATIO = 0.15;

/** How long a quad must be detected continuously before the shutter enables. */
export const STABILITY_MS = 500;

/** Width (px) the live camera frame is downscaled to before running contour detection. */
export const DETECT_FRAME_WIDTH = 500;

/** Width (px) a captured/gallery still is downscaled to for detection; the perspective warp itself runs on the full-resolution image. */
export const STILL_DETECT_WIDTH = 800;

/** Max edge (px) of the final processed JPEG used for storage, upload, display and the AI payload. */
export const OUTPUT_MAX_EDGE_PX = 1024;

/** JPEG quality for the final document-scan output. */
export const OUTPUT_JPEG_QUALITY = 0.85;
