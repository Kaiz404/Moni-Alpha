import Svg, { Circle, Path, Polyline } from 'react-native-svg';

import { useThemeTokens } from '@/hooks/use-theme-tokens';

const W = 72;
const H = 28;

export function CategorySpark({ totals, color }: { totals: number[]; color: string | null }) {
  const tokens = useThemeTokens();
  const top = Math.max(1, ...totals);
  const step = (W - 4) / Math.max(1, totals.length - 1);
  const points = totals.map((value, i) => [2 + i * step, 26 - (value / top) * 22] as const);
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = points.at(-1) ?? [2, 26];
  const area = `M2,${H} L${line.replaceAll(' ', ' L')} L${last[0].toFixed(1)},${H} Z`;
  return (
    <Svg width={W} height={H} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={area} fill={color ?? tokens.sand} fillOpacity={0.55} />
      <Polyline points={line} fill="none" stroke={tokens.ink2} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={last[0]} cy={last[1]} r={3} fill={tokens.foreground} stroke={tokens.card} strokeWidth={1.5} />
    </Svg>
  );
}
