import type { CapturedNotificationStatus } from '@repo/types';
import { View } from 'react-native';

import { CaptureStatusPill } from '@/components/capture-log/status-pill';
import { ListCard } from '@/components/ui/list-card';
import { Text } from '@/components/ui/text';
import { CAPTURE_STATUS_ORDER } from '@/lib/notifications/capture-log';

const MEANING: Record<CapturedNotificationStatus, string> = {
  waiting_for_review: 'In Review now. Not counted in totals yet.',
  trying_again: "Moni couldn't be reached. It keeps the alert and tries again. Nothing added yet.",
  gave_up: 'Moni tried for 7 days and stopped. Retry to try again. Nothing added.',
  auto_added: 'Added without asking, by an auto-add rule. Marked Auto.',
  added: 'You approved it in Review.',
  same_payment: 'Another alert for one payment. Counted once. Undo if they are two.',
  not_linked: "The app isn't linked to a wallet. Nothing added.",
  ignored: 'Not a payment. Nothing added.',
};

export function StatusLegend() {
  return (
    <View className="gap-1.5">
      <Text
        variant="caps"
        className="px-1.5 text-ink-2"
        accessibilityRole="header"
      >
        What each status means
      </Text>
      <ListCard>
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
      </ListCard>
    </View>
  );
}
