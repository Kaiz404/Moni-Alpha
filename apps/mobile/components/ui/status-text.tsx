import { Text } from '@/components/ui/text';

export type StatusTone = 'auto' | 'review' | 'onTrack' | 'near' | 'over' | 'quiet';

const colours: Record<StatusTone, string> = {
  auto: 'text-ink-2',
  review: 'text-state-pending',
  onTrack: 'text-state-approved',
  near: 'text-state-attention',
  over: 'text-state-destructive',
  quiet: 'text-muted',
};

/** A status said by its colour and weight alone: no capsule, no dot (#85). */
export function StatusText({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <Text
      className={`text-[13px] leading-[18px] font-display-bold ${colours[tone]}`}
      style={{ fontVariant: ['tabular-nums'] }}
      numberOfLines={1}
    >
      {label}
    </Text>
  );
}
