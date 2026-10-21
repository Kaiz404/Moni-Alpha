import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ListCard } from '@/components/ui/list-card';

export const SKELETON_DELAY_MS = 300;

export function Skeleton({ rows = 3 }: { rows?: number }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), SKELETON_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!shown) return null;
  return (
    <View
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      <ListCard>
        {Array.from({ length: rows }, (_, index) => (
          <View
            key={index}
            className="h-[66px] flex-row items-center gap-3.5 px-[18px]"
          >
            <View className="h-[42px] w-[42px] rounded-full bg-sand-light" />
            <View className="flex-1 gap-2">
              <View className="h-3.5 w-[52%] rounded-full bg-sand-light" />
              <View className="h-2.5 w-[34%] rounded-full bg-sand-light" />
            </View>
            <View className="h-3.5 w-16 rounded-full bg-sand-light" />
          </View>
        ))}
      </ListCard>
    </View>
  );
}
