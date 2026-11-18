import { View } from 'react-native';

import { BRAND_LOCKUP } from '@/components/brand/mascot-art.generated';
import { Mascot } from '@/components/brand/mascot';
import { Wordmark } from '@/components/brand/wordmark';

type LockupProps = {
  kind: 'horizontal' | 'stacked';
  /** Tile height H; every other measure is a share of it. Not below 24. */
  size: number;
  dot?: boolean;
};

/** The app-icon tile with the wordmark beside it or under it. */
export function Lockup({ kind, size, dot = true }: LockupProps) {
  const horizontal = kind === 'horizontal';
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel="Moni"
      className={
        horizontal ? 'flex-row items-center' : 'items-center'
      }
      style={{
        gap:
          size *
          (horizontal ? BRAND_LOCKUP.h_gap : BRAND_LOCKUP.s_gap),
      }}
    >
      <Mascot
        variant="tile"
        size={size}
        decorative
      />
      <View
        style={
          horizontal
            ? {
                transform: [
                  { translateY: size * BRAND_LOCKUP.h_nudge },
                ],
              }
            : undefined
        }
      >
        <Wordmark
          size={
            size *
            (horizontal ? BRAND_LOCKUP.h_word : BRAND_LOCKUP.s_word)
          }
          dot={dot}
        />
      </View>
    </View>
  );
}
