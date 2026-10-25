import { View } from 'react-native';

import { Text } from '@/components/ui/text';

export type StatusTone =
  | 'auto'
  | 'review'
  | 'onTrack'
  | 'near'
  | 'over'
  | 'quiet';

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
  quiet: {
    fill: 'bg-sand-light',
    text: 'text-muted',
    dot: 'bg-muted',
  },
};

const sizes = {
  default: {
    frame: 'min-h-[30px] gap-[7px] px-3',
    label: 'text-[13px] leading-[18px]',
  },
  small: {
    frame: 'min-h-7 gap-1.5 px-3',
    label: 'text-[13px] leading-[18px]',
  },
  compact: {
    frame: 'h-[26px] gap-1.5 px-2.5',
    label: 'text-[12px] leading-[16px] tracking-[0.24px]',
  },
} as const;

export function StatusPill({
  tone,
  label,
  variant = 'standalone',
  size = 'default',
  align = 'start',
}: {
  tone: StatusTone;
  label: string;
  variant?: 'inline' | 'standalone';
  /**
   * A standalone pill: `default` 30 tall, `small` 28 (XM-Detail), `compact` 26 with a 12/700
   * label (the capture pages, the capture log).
   */
  size?: keyof typeof sizes;
  align?: 'start' | 'center';
}) {
  const look = tones[tone];
  if (variant === 'inline') {
    return (
      <View
        className={`min-h-5 justify-center rounded-full px-2 ${look.fill}`}
      >
        <Text
          className={`text-[12px] leading-[16px] font-display-bold ${look.text}`}
        >
          {label}
        </Text>
      </View>
    );
  }
  const shape = sizes[size];
  return (
    <View
      className={`${shape.frame} ${align === 'center' ? 'self-center' : 'self-start'} flex-row items-center rounded-full ${look.fill}`}
    >
      <View className={`h-1.5 w-1.5 rounded-full ${look.dot}`} />
      <Text
        className={`${shape.label} font-display-bold ${look.text}`}
        numberOfLines={size === 'compact' ? 1 : undefined}
      >
        {label}
      </Text>
    </View>
  );
}
