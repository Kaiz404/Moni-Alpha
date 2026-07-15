/**
 * Post-capture / gallery-pick processing: detect → perspective-crop → document-scan filter →
 * cap output resolution. Runs entirely inside a `react-native-worklets-core` Worklet (see
 * `useWorklet('default', processReceiptStill)` in `components/receipt/receipt-camera.tsx`) —
 * react-native-fast-opencv's native bindings only exist on Worklet runtimes.
 *
 * A `null` return means no receipt-like quad was found — the caller must hard-reject
 * (never enqueue/upload the source image).
 */
import {
  BorderTypes,
  ColorConversionCodes,
  DataTypes,
  DecompTypes,
  InterpolationFlags,
  NormTypes,
  ObjectType,
  OpenCV,
} from 'react-native-fast-opencv';
import type { PointVector } from 'react-native-fast-opencv';

import { findReceiptQuad } from './detect-core';
import type { Point, Quad } from './types';
import { OUTPUT_JPEG_QUALITY, OUTPUT_MAX_EDGE_PX, STILL_DETECT_WIDTH } from './types';

function distance(a: Point, b: Point): number {
  'worklet';
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointVectorFromPoints(points: readonly Point[]): PointVector {
  'worklet';
  const vector = OpenCV.createObject(ObjectType.PointVector);
  for (const point of points) {
    const p = OpenCV.createObject(ObjectType.Point, Math.round(point.x), Math.round(point.y));
    OpenCV.addObjectToVector(vector, p);
  }
  return vector;
}

/**
 * Detects the receipt quad in `sourceBase64`, perspective-crops it, converts to a
 * contrast-stretched grayscale "document scan" look, caps the longest edge at
 * `OUTPUT_MAX_EDGE_PX`, and writes the result to `destinationPath` (a plain filesystem path,
 * no `file://` scheme — matches what `OpenCV.saveMatToFile` expects natively).
 *
 * Returns `{ ok: true, width, height }` on success, or `{ ok: false }` if no receipt-like
 * quad was found in the image.
 */
export function processReceiptStill(
  sourceBase64: string,
  destinationPath: string,
): { ok: true; width: number; height: number } | { ok: false } {
  'worklet';

  const source = OpenCV.base64ToMat(sourceBase64);
  const { cols: fullWidth, rows: fullHeight } = OpenCV.toJSValue(source);

  // Detect on a small disposable copy — `source` itself is needed intact for the warp below.
  const detectScale = Math.min(1, STILL_DETECT_WIDTH / fullWidth);
  const detectWidth = Math.round(fullWidth * detectScale);
  const detectHeight = Math.round(fullHeight * detectScale);

  const detectMat = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_8U);
  const detectSize = OpenCV.createObject(ObjectType.Size, detectWidth, detectHeight);
  OpenCV.invoke('resize', source, detectMat, detectSize, 0, 0, InterpolationFlags.INTER_AREA);

  const quadAtDetectScale = findReceiptQuad(detectMat, detectWidth, detectHeight);
  if (!quadAtDetectScale) {
    OpenCV.clearBuffers();
    return { ok: false };
  }

  const inverseScale = 1 / detectScale;
  const quad = quadAtDetectScale.map((p: Point) => ({ x: p.x * inverseScale, y: p.y * inverseScale })) as Quad;

  // Output rectangle matches the receipt's own aspect ratio (longest opposite edges).
  const outputWidth = Math.round(Math.max(distance(quad[0], quad[1]), distance(quad[3], quad[2])));
  const outputHeight = Math.round(Math.max(distance(quad[0], quad[3]), distance(quad[1], quad[2])));

  const srcPoints = pointVectorFromPoints(quad);
  const dstPoints = pointVectorFromPoints([
    { x: 0, y: 0 },
    { x: outputWidth - 1, y: 0 },
    { x: outputWidth - 1, y: outputHeight - 1 },
    { x: 0, y: outputHeight - 1 },
  ]);
  const transform = OpenCV.invoke('getPerspectiveTransform', srcPoints, dstPoints, DecompTypes.DECOMP_LU);

  const warped = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_8U);
  const outputSize = OpenCV.createObject(ObjectType.Size, outputWidth, outputHeight);
  const borderValue = OpenCV.createObject(ObjectType.Scalar, 0, 0, 0);
  OpenCV.invoke(
    'warpPerspective',
    source,
    warped,
    transform,
    outputSize,
    InterpolationFlags.INTER_LINEAR,
    BorderTypes.BORDER_CONSTANT,
    borderValue,
  );

  // Document-scan look: grayscale + full-range contrast stretch (softer than binary threshold,
  // keeps OCR-friendly gradients for the LLM).
  OpenCV.invoke('cvtColor', warped, warped, ColorConversionCodes.COLOR_BGR2GRAY);
  OpenCV.invoke('normalize', warped, warped, 255, NormTypes.NORM_MINMAX);

  let finalWidth = outputWidth;
  let finalHeight = outputHeight;
  const longestEdge = Math.max(outputWidth, outputHeight);
  if (longestEdge > OUTPUT_MAX_EDGE_PX) {
    const finalScale = OUTPUT_MAX_EDGE_PX / longestEdge;
    finalWidth = Math.round(outputWidth * finalScale);
    finalHeight = Math.round(outputHeight * finalScale);
    const finalSize = OpenCV.createObject(ObjectType.Size, finalWidth, finalHeight);
    OpenCV.invoke('resize', warped, warped, finalSize, 0, 0, InterpolationFlags.INTER_AREA);
  }

  OpenCV.saveMatToFile(warped, destinationPath, 'jpeg', OUTPUT_JPEG_QUALITY);
  OpenCV.clearBuffers();

  return { ok: true, width: finalWidth, height: finalHeight };
}
