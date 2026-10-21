import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ListCard } from '@/components/ui/list-card';
import { Text } from '@/components/ui/text';

export function DayGroup({
  label,
  total,
  children,
}: {
  label: string;
  total: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-2.5">
      <View className="flex-row items-center justify-between px-1">
        <Text variant="caps" className="text-muted" accessibilityRole="header">
          {label}
        </Text>
        <Text
          variant="meta"
          className="font-display-semibold text-muted"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {total}
        </Text>
      </View>
      <ListCard>{children}</ListCard>
    </View>
  );
}
