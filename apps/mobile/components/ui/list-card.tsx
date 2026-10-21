import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

/** Paper list card: radius 26, 6 top and bottom, no borders or dividers. */
export function ListCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <View
      className={`overflow-hidden rounded-card bg-card py-1.5 ${className ?? ''}`}
    >
      {children}
    </View>
  );
}

/** A caps label over its list card, as day groups and settings sections draw it. */
export function ListSection({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={`gap-2.5 ${className ?? ''}`}>
      <Text
        variant="caps"
        className="pl-1 text-muted"
        accessibilityRole="header"
      >
        {label}
      </Text>
      <ListCard>{children}</ListCard>
    </View>
  );
}
