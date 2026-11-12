import { View } from 'react-native';

import { Text } from '@/components/ui/text';

const TINTS = [
  'bg-chart-3',
  'bg-chart-1',
  'bg-chart-6',
  'bg-chart-2',
  'bg-chart-5',
  'bg-chart-4',
] as const;

/** The same person always gets the same chart colour, solid with an Ink initial. */
function tintFor(name: string): string {
  let hash = 0;
  for (const char of name.trim().toLowerCase())
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
}

/** A rounded-square initial: 42 in rows, 52 on the debt page. Closed debts go Sand. */
export function PersonAvatar({
  name,
  size = 42,
  closed = false,
}: {
  name: string;
  size?: 42 | 52;
  closed?: boolean;
}) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      className={`items-center justify-center rounded-[16px] ${closed ? 'bg-sand' : tintFor(name)}`}
      style={{ width: size, height: size }}
    >
      <Text
        className={`font-display-bold ${closed ? 'text-ink-2' : 'text-on-category'} ${size === 52 ? 'text-[22px] leading-[26px]' : 'text-[18px] leading-[22px]'}`}
      >
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}
