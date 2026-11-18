import type { FunctionResult } from './account-functions';
import type { IconName } from './icons';

/** W2-Parts "Delete your account": what goes, in the board's and the phone's words and icons. */
export const DELETED: readonly { icon: IconName; text: string }[] = [
  { icon: 'receipt-text', text: 'Transactions, wallets and balances' },
  { icon: 'chart-box', text: 'Budgets, debts, rules and merchant names' },
  { icon: 'bell-outline', text: "Captures and the alert text stored in Moni's cloud database" },
  { icon: 'camera-outline', text: 'Receipt photos' },
  { icon: 'message-outline', text: 'Moni chat history' },
  { icon: 'account-outline', text: 'Your sign-in, on every device' },
];

export const CONFIRM_WORD = 'DELETE';

/** DELETE in any letter case, pasted or typed, with stray spaces. */
export function confirmsDeletion(typed: string): boolean {
  return typed.trim().toUpperCase() === CONFIRM_WORD;
}

/** The line under the field when the call failed, or null when the account is gone. */
export function deletionFailure(result: FunctionResult<unknown>): string | null {
  switch (result.kind) {
    case 'ok':
      return null;
    case 'unreachable':
      return "Couldn't reach Moni. Check your connection and try again.";
    case 'refused':
      return `Couldn't delete your account. ${result.message}`;
  }
}
