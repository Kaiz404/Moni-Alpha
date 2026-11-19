import { View } from 'react-native';

import { Text } from '@/components/ui/text';

const tones = {
  auto: { fill: 'bg-sand', text: 'text-ink-2' },
  review: { fill: 'bg-pending-fill', text: 'text-state-pending' },
} as const;

/** The 20-tall meta pill a row shows before its meta (Auto, To review, Not mine). One line, so Android can't break it at its space. */
export function StatusPill({
  tone,
  label,
}: {
  tone: keyof typeof tones;
  label: string;
}) {
  const look = tones[tone];
  return (
    <View className={`min-h-5 justify-center rounded-full px-2 ${look.fill}`}>
      <Text
        className={`text-[12px] leading-[16px] font-display-bold ${look.text}`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
