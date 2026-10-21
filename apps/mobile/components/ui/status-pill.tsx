import { View } from 'react-native';

import { Text } from '@/components/ui/text';

export type StatusTone =
  | 'auto'
  | 'review'
  | 'onTrack'
  | 'near'
  | 'over';

const tones: Record<
  StatusTone,
  { fill: string; text: string; dot: string }
> = {
  auto: { fill: 'bg-sand', text: 'text-ink-2', dot: 'bg-ink-2' },
  review: {
    fill: 'bg-pending-fill',
    text: 'text-state-pending',
    dot: 'bg-state-pending',
  },
  onTrack: {
    fill: 'bg-primary-muted',
    text: 'text-state-approved',
    dot: 'bg-state-approved',
  },
  near: {
    fill: 'bg-attention-fill',
    text: 'text-state-attention',
    dot: 'bg-state-attention',
  },
  over: {
    fill: 'bg-destructive-fill',
    text: 'text-state-destructive',
    dot: 'bg-state-destructive',
  },
};

/**
 * `row` is the 20-tall pill that leads a row's meta ("Auto", "To review").
 * `block` is the 30-tall pill with a dot that stands on its own.
 */
export function StatusPill({
  tone,
  label,
  size = 'block',
}: {
  tone: StatusTone;
  label: string;
  size?: 'row' | 'block';
}) {
  const look = tones[tone];
  if (size === 'row') {
    return (
      <View
        className={`h-5 justify-center rounded-full px-2 ${look.fill}`}
      >
        <Text
          className={`text-[12px] leading-[16px] font-display-bold ${look.text}`}
        >
          {label}
        </Text>
      </View>
    );
  }
  return (
    <View
      className={`h-[30px] flex-row items-center gap-[7px] self-start rounded-full px-3 ${look.fill}`}
    >
      <View className={`h-1.5 w-1.5 rounded-full ${look.dot}`} />
      <Text
        className={`text-[13px] leading-[18px] font-display-bold ${look.text}`}
      >
        {label}
      </Text>
    </View>
  );
}
