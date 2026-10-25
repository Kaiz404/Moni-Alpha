import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ListCard } from '@/components/ui/list-card';

export const SKELETON_DELAY_MS = 300;

/** V2F-States row bars vary so the list reads as rows, not a pattern: title, meta, amount. */
const BARS = [
  { title: '60%', meta: '40%', amount: 60 },
  { title: '48%', meta: '32%', amount: 48 },
  { title: '52%', meta: '38%', amount: 56 },
] as const;

export function Skeleton({
  rows = 3,
  label = 'Loading',
}: {
  rows?: number;
  /** What TalkBack reads, such as "Loading older spends". */
  label?: string;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), SKELETON_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!shown) return null;
  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
    >
      <ListCard>
        {Array.from({ length: rows }, (_, index) => {
          const bars = BARS[index % BARS.length];
          return (
            <View
              key={index}
              className="h-[66px] flex-row items-center gap-3.5 px-[18px]"
            >
              <View className="h-[42px] w-[42px] rounded-full bg-sand-light" />
              <View className="flex-1 gap-2">
                <View
                  className="h-3.5 rounded-full bg-sand-light"
                  style={{ width: bars.title }}
                />
                <View
                  className="h-2.5 rounded-full bg-sand-light"
                  style={{ width: bars.meta }}
                />
              </View>
              <View
                className="h-3.5 rounded-full bg-sand-light"
                style={{ width: bars.amount }}
              />
            </View>
          );
        })}
      </ListCard>
    </View>
  );
}
