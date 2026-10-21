import { View } from 'react-native';

import { Text } from '@/components/ui/text';

const TINTS = [
  'bg-lilac',
  'bg-mint',
  'bg-peach',
  'bg-sky',
  'bg-aqua',
  'bg-lemon',
] as const;

/** The same person always gets the same pastel. */
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
        className={`font-display-bold ${closed ? 'text-ink-2' : 'text-on-pastel'} ${size === 52 ? 'text-[22px] leading-[26px]' : 'text-[18px] leading-[22px]'}`}
      >
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}
