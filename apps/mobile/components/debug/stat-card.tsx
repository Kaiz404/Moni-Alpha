import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

export function StatCard({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View className="flex-1 rounded-2xl bg-surface-2 px-3 py-2.5">
      <Text className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </Text>
      <View className="mt-1">{children}</View>
    </View>
  );
}
