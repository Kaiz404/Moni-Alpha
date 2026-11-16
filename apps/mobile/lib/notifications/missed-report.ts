import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { curatedPackagesEquivalent } from '@/lib/notifications/notification-package-aliases';

/** Params for Type it (`app/transaction/new.tsx`). `missedFrom` records the source on save. */
export type MissedTransactionParams = {
  missedFrom: string;
  walletId?: string;
  amount?: string;
  note?: string;
  date?: string;
  type?: 'income';
};

const AMOUNT = /(?:\b(?:RM|MYR)|\$)\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/i;
const INCOME = /\b(credited|received|refund|refunded|dikreditkan|diterima)\b/i;
const PAYEE =
  /\b(?:at|to|from|kepada|daripada|dari)\s+([\p{L}\p{N}*&'][\p{L}\p{N}*&' .-]{1,40}?)(?=\s+(?:on|pada|with|via|using|was|is|has|successful|berjaya|telah)\b|[.,;:]|$)/iu;

/** What an ignored alert already says, so Type it opens with it filled in. */
export function prefillFromAlert(
  text: string,
  receivedAt: string,
): Pick<MissedTransactionParams, 'amount' | 'note' | 'date' | 'type'> {
  const amount = text.match(AMOUNT)?.[1]?.replace(/,/g, '');
  const note = text.match(PAYEE)?.[1]?.trim();
  const received = new Date(receivedAt);
  return {
    ...(amount ? { amount } : {}),
    ...(note ? { note } : {}),
    ...(Number.isNaN(received.getTime()) ? {} : { date: toLocalDateInput(received) }),
    ...(INCOME.test(text) ? { type: 'income' as const } : {}),
  };
}

/** The wallet a linked app feeds, for Type it to open on. A wallet reads one app. */
export function walletForApp<W extends { id: string; notificationPackage: string | null }>(
  packageName: string,
  wallets: readonly W[],
): W | undefined {
  return wallets.find((wallet) => curatedPackagesEquivalent(wallet.notificationPackage, packageName));
}
