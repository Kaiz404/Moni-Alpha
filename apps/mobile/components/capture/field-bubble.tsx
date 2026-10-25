import type { ReactNode } from 'react';
import { View } from 'react-native';

/** The 32 tint circle that leads a capture field: the category, the wallet, the date. */
export function FieldBubble({
  color,
  children,
}: {
  color: string;
  children: ReactNode;
}) {
  return (
    <View
      className="h-8 w-8 items-center justify-center rounded-full"
      style={{ backgroundColor: color }}
    >
      {children}
    </View>
  );
}
