import type { CapturedNotificationStatus } from '@repo/types';

import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { CAPTURE_STATUS_LABELS } from '@/lib/notifications/capture-log';

const TONES: Record<CapturedNotificationStatus, StatusTone> = {
  waiting_for_review: 'review',
  auto_added: 'auto',
  added: 'onTrack',
  not_linked: 'near',
  ignored: 'quiet',
};

/** The capture log's compact status pill; one tone per glossary status. */
export function CaptureStatusPill({ status }: { status: CapturedNotificationStatus }) {
  return (
    <StatusPill
      tone={TONES[status]}
      size="compact"
      label={CAPTURE_STATUS_LABELS[status]}
    />
  );
}
