import { StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import type { Quad } from '@/lib/receipts/types';

/** Maps a quad from camera-frame pixel space into preview-view coordinates (cover resize). */
export function mapFrameQuadToView(
  quad: Quad,
  frameWidth: number,
  frameHeight: number,
  viewWidth: number,
  viewHeight: number,
): Quad {
  const frameAspect = frameWidth / frameHeight;
  const viewAspect = viewWidth / viewHeight;

  let scale: number;
  let offsetX: number;
  let offsetY: number;

  if (frameAspect > viewAspect) {
    scale = viewHeight / frameHeight;
    offsetX = (viewWidth - frameWidth * scale) / 2;
    offsetY = 0;
  } else {
    scale = viewWidth / frameWidth;
    offsetX = 0;
    offsetY = (viewHeight - frameHeight * scale) / 2;
  }

  return quad.map(({ x, y }) => ({
    x: x * scale + offsetX,
    y: y * scale + offsetY,
  })) as Quad;
}

function quadToPoints(quad: Quad): string {
  return quad.map(({ x, y }) => `${x},${y}`).join(' ');
}

type ReceiptQuadOverlayProps = {
  quad: Quad | null;
  color: string;
};

/** Brand-color fill + stroke overlay for a detected receipt quad. */
export function ReceiptQuadOverlay({ quad, color }: ReceiptQuadOverlayProps) {
  if (quad == null) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Polygon
          points={quadToPoints(quad)}
          fill={color}
          fillOpacity={0.18}
          stroke={color}
          strokeWidth={4}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
