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
    <View className="gap-1.5">
      <View className="min-h-5 flex-row items-center justify-between px-1.5">
        <Text variant="caps" className="text-ink-2" accessibilityRole="header">
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
