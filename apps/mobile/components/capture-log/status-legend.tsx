import type { CapturedNotificationStatus } from '@repo/types';
import { View } from 'react-native';

import { CaptureStatusPill } from '@/components/capture-log/status-pill';
import { ListSection } from '@/components/ui/list-card';
import { Text } from '@/components/ui/text';
import { CAPTURE_STATUS_ORDER } from '@/lib/notifications/capture-log';

const MEANING: Record<CapturedNotificationStatus, string> = {
  waiting_for_review: 'In Review now. Not counted in totals yet.',
  auto_added: 'Added without asking, by an auto-add rule. Marked Auto.',
  added: 'You approved it in Review.',
  not_linked: "The app isn't linked to a wallet. Nothing added.",
  ignored: 'Not a payment. Nothing added.',
};

export function StatusLegend() {
  return (
    <ListSection label="What each status means">
      {CAPTURE_STATUS_ORDER.map((status) => (
        <View
          key={status}
          accessible
          className="items-start gap-1 px-[18px] py-2.5"
        >
          <CaptureStatusPill status={status} />
          <Text className="text-[14px] leading-[20px] text-ink-2">{MEANING[status]}</Text>
        </View>
      ))}
    </ListSection>
  );
}
