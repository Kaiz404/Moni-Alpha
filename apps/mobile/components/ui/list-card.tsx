import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

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

export function ListSection({
  label,
  children,
  gap = 10,
  className,
}: {
  label: string;
  children: ReactNode;
  /** Label to card: 10 in day-grouped lists (V2F-Components), 8 on settings pages (V2H-Profile). */
  gap?: 8 | 10;
  className?: string;
}) {
  return (
    <View
      className={className}
      style={{ gap }}
    >
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
