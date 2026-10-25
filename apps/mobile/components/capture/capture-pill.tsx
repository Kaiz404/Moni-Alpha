import { View } from 'react-native';

import { Text } from '@/components/ui/text';

/** The board's 26-tall capture pill: Lilac for listening, Lemon for the mic being off. */
export function CapturePill({ tone, label }: { tone: 'pending' | 'attention'; label: string }) {
  const look =
    tone === 'pending'
      ? { fill: 'bg-pending-fill', text: 'text-state-pending', dot: 'bg-state-pending' }
      : { fill: 'bg-attention-fill', text: 'text-state-attention', dot: 'bg-state-attention' };
  return (
    <View
      className={`h-[26px] flex-row items-center gap-1.5 self-center rounded-full px-2.5 ${look.fill}`}
    >
      <View className={`h-1.5 w-1.5 rounded-full ${look.dot}`} />
      <Text
        className={`text-[12px] leading-[16px] font-display-bold tracking-[0.24px] ${look.text}`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
