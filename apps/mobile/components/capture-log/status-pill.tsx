import type { CapturedNotificationStatus } from '@repo/types';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { CAPTURE_STATUS_LABELS } from '@/lib/notifications/capture-log';

const tones: Record<CapturedNotificationStatus, { fill: string; text: string; dot: string }> = {
  waiting_for_review: {
    fill: 'bg-pending-fill',
    text: 'text-state-pending',
    dot: 'bg-state-pending',
  },
  auto_added: { fill: 'bg-sand', text: 'text-ink-2', dot: 'bg-ink-2' },
  added: {
    fill: 'bg-primary-muted',
    text: 'text-state-approved',
    dot: 'bg-state-approved',
  },
  not_linked: {
    fill: 'bg-attention-fill',
    text: 'text-state-attention',
    dot: 'bg-state-attention',
  },
  ignored: { fill: 'bg-sand-light', text: 'text-muted', dot: 'bg-muted' },
};

/** The capture log's 26-tall status pill; one tone per glossary status. */
export function CaptureStatusPill({ status }: { status: CapturedNotificationStatus }) {
  const tone = tones[status];
  return (
    <View
      className={`h-[26px] flex-row items-center gap-1.5 self-start rounded-full px-2.5 ${tone.fill}`}
    >
      <View className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      <Text className={`text-[12px] leading-[16px] font-display-bold ${tone.text}`}>
        {CAPTURE_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}
