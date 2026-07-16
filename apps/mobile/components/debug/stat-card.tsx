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
    <View className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
      <Text className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</Text>
      <View className="mt-1">{children}</View>
    </View>
  );
}
