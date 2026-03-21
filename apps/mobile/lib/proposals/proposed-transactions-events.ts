import { DeviceEventEmitter } from 'react-native';

/** Fired when local proposed_transactions rows change (insert/update/delete) or sync may have updated them. */
export const PROPOSED_TRANSACTIONS_CHANGED = 'moni:proposed_transactions_changed';

export function emitProposedTransactionsChanged(): void {
  DeviceEventEmitter.emit(PROPOSED_TRANSACTIONS_CHANGED);
}
