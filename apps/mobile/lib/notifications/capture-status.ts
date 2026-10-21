import { createMMKV } from 'react-native-mmkv';
import type { CapturedNotificationStatus } from '@repo/types';
import {
  captureStatusAfterExtraction as afterExtraction,
  setCaptureStatus,
} from './capture-status.core.js';

const notificationStorage = createMMKV({ id: 'moni-notifications' });

export function captureStatusAfterExtraction(result: {
  transactionId?: string;
  proposalId?: string;
}): CapturedNotificationStatus {
  return afterExtraction(result) as CapturedNotificationStatus;
}

export function markCaptureStatus(
  id: string,
  status: CapturedNotificationStatus,
  transactionId?: string,
): void {
  setCaptureStatus(notificationStorage, id, status, transactionId);
}
