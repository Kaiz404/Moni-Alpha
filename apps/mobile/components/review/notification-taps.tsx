import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import {
  ensureReviewNotificationPermission,
  handleReviewNotificationResponse,
  reviewProposalIdOf,
  showReviewNotificationsInForeground,
} from '@/lib/notifications/review-notification';

/**
 * A tap on the review notification's body opens the deck on that capture, including the tap
 * that launched the app. An action tap while Moni is open runs here; with Moni in the
 * background or killed it runs in the task index.js registers.
 */
export function ReviewNotificationTaps() {
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    showReviewNotificationsInForeground();
    void ensureReviewNotificationPermission().catch(() => {});
  }, []);

  useEffect(() => {
    if (!response) return;
    const proposalId = reviewProposalIdOf(response);
    if (!proposalId) return;
    Notifications.clearLastNotificationResponse();
    if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      router.push({ pathname: '/review', params: { id: proposalId } });
    } else {
      void handleReviewNotificationResponse(response);
    }
  }, [response]);

  return null;
}
