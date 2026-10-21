import type { ReactNode } from 'react';
import { View } from 'react-native';

/** The 34 tint circle that leads a capture field: the category, the wallet, the date. */
export function FieldBubble({
  color,
  children,
}: {
  color: string;
  children: ReactNode;
}) {
  return (
    <View
      className="h-[34px] w-[34px] items-center justify-center rounded-full"
      style={{ backgroundColor: color }}
    >
      {children}
    </View>
  );
}
