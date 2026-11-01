import { DeviceEventEmitter } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import type { CapturedNotificationStatus } from '@repo/types';
import {
  captureStatusAfterExtraction as afterExtraction,
  setCaptureStatus,
} from './capture-status.core.js';

const notificationStorage = createMMKV({ id: 'moni-notifications' });
const CAPTURE_STATUS_CHANGED = 'capture-status-changed';

export function captureStatusAfterExtraction(result: {
  transactionId?: string;
  proposalId?: string;
  skipped: boolean;
}): CapturedNotificationStatus {
  return afterExtraction(result) as CapturedNotificationStatus;
}

export function markCaptureStatus(
  id: string,
  status: CapturedNotificationStatus,
  transactionId?: string,
  pairedProposalId?: string,
): void {
  setCaptureStatus(notificationStorage, id, status, transactionId, pairedProposalId);
  DeviceEventEmitter.emit(CAPTURE_STATUS_CHANGED);
}

/** The processor writes behind the UI, so a page showing statuses listens for it. */
export function onCaptureStatusChanged(listener: () => void): () => void {
  const subscription = DeviceEventEmitter.addListener(CAPTURE_STATUS_CHANGED, listener);
  return () => subscription.remove();
}
