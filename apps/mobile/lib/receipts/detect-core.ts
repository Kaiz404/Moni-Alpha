/**
 * Shared receipt-quad detection logic used by both the live Skia frame processor
 * (`components/receipt/receipt-camera.tsx`) and the still-image pipeline
 * (`lib/receipts/preprocess.ts`). Keeping this in one place means detection tuning
 * (kernel sizes, Canny thresholds, area ratio) only ever needs to happen once.
 *
 * Every export here runs inside a Worklet context (VisionCamera's Skia frame-processor
 * runtime, or a `react-native-worklets-core` `useWorklet` context) — react-native-fast-opencv's
 * native bindings are only installed on Worklet runtimes, never on the plain RN JS thread.
 */
import {
  ColorConversionCodes,
  ContourApproximationModes,
  MorphShapes,
  MorphTypes,
  ObjectType,
  OpenCV,
  RetrievalModes,
} from 'react-native-fast-opencv';
import type { Mat } from 'react-native-fast-opencv';

import { MIN_CONTOUR_AREA_RATIO } from './types';
import type { Point, Quad } from './types';

/** Orders 4 arbitrary corners into [topLeft, topRight, bottomRight, bottomLeft]. */
export function orderQuadCorners(points: Point[]): Quad {
  'worklet';

  const sums = points.map((p) => p.x + p.y);
  const diffs = points.map((p) => p.x - p.y);

  const topLeft = points[sums.indexOf(Math.min(...sums))]!;
  const bottomRight = points[sums.indexOf(Math.max(...sums))]!;
  const topRight = points[diffs.indexOf(Math.max(...diffs))]!;
  const bottomLeft = points[diffs.indexOf(Math.min(...diffs))]!;

  return [topLeft, topRight, bottomRight, bottomLeft];
}

/**
 * Finds the largest 4-point document-like contour in `workingMat`.
 *
 * `workingMat` is mutated destructively (grayscale → morphology → blur → Canny) — always pass a
 * disposable BGR copy sized `width` x `height`, never a Mat you still need afterwards.
 *
 * Returns the quad in `workingMat`'s own pixel coordinate space, or `null` if no contour
 * above `MIN_CONTOUR_AREA_RATIO` of the frame area approximates to 4 points.
 */
export function findReceiptQuad(workingMat: Mat, width: number, height: number): Quad | null {
  'worklet';

  OpenCV.invoke('cvtColor', workingMat, workingMat, ColorConversionCodes.COLOR_BGR2GRAY);

  const morphKernelSize = OpenCV.createObject(ObjectType.Size, 4, 4);
  const blurKernelSize = OpenCV.createObject(ObjectType.Size, 7, 7);
  const structuringElement = OpenCV.invoke('getStructuringElement', MorphShapes.MORPH_ELLIPSE, morphKernelSize);

  OpenCV.invoke('morphologyEx', workingMat, workingMat, MorphTypes.MORPH_OPEN, structuringElement);
  OpenCV.invoke('morphologyEx', workingMat, workingMat, MorphTypes.MORPH_CLOSE, structuringElement);
  OpenCV.invoke('GaussianBlur', workingMat, workingMat, blurKernelSize, 0);
  OpenCV.invoke('Canny', workingMat, workingMat, 75, 100);

  const contours = OpenCV.createObject(ObjectType.PointVectorOfVectors);
  OpenCV.invoke(
    'findContours',
    workingMat,
    contours,
    RetrievalModes.RETR_LIST,
    ContourApproximationModes.CHAIN_APPROX_SIMPLE,
  );

  const contoursResult = OpenCV.toJSValue(contours);
  const minArea = width * height * MIN_CONTOUR_AREA_RATIO;

  let bestQuad: Quad | null = null;
  let bestArea = minArea;

  for (let i = 0; i < contoursResult.array.length; i++) {
    const contour = OpenCV.copyObjectFromVector(contours, i);
    const { value: area } = OpenCV.invoke('contourArea', contour, false);
    if (area <= bestArea) continue;

    const { value: perimeter } = OpenCV.invoke('arcLength', contour, true);
    const approx = OpenCV.createObject(ObjectType.PointVector);
    OpenCV.invoke('approxPolyDP', contour, approx, 0.02 * perimeter, true);

    const approxPoints = OpenCV.toJSValue(approx).array;
    if (approxPoints.length === 4) {
      bestQuad = orderQuadCorners(approxPoints);
      bestArea = area;
    }
  }

  return bestQuad;
}
