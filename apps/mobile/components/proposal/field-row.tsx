import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';

export function FieldRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View className="mb-3 flex-row items-center">
      <Text className="w-24 text-sm text-muted">{label}</Text>
      {children}
    </View>
  );
}
