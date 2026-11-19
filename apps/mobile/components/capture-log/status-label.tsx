import type { CapturedNotificationStatus } from '@repo/types';

import { StatusText, type StatusTone } from '@/components/ui/status-text';
import { CAPTURE_STATUS_LABELS } from '@/lib/notifications/capture-log';

const TONES: Record<CapturedNotificationStatus, StatusTone> = {
  waiting_for_review: 'review',
  trying_again: 'review',
  gave_up: 'near',
  needs_ai: 'review',
  auto_added: 'auto',
  added: 'onTrack',
  same_payment: 'quiet',
  not_linked: 'near',
  ignored: 'quiet',
};

/** The capture log's status, one colour per glossary status. */
export function CaptureStatusLabel({ status }: { status: CapturedNotificationStatus }) {
  return (
    <StatusText
      tone={TONES[status]}
      label={CAPTURE_STATUS_LABELS[status]}
    />
  );
}
