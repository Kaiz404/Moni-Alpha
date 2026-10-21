import { formatMoney } from '@/lib/finance/format-money';
import type { DebtSide } from '@/lib/finance/debt-summary';

/**
 * Every word that flips with who owes whom, in one table, so a screen never
 * branches on direction for copy. `name` is the other person.
 */
export const SIDE_WORDS = {
  owed_to_me: {
    tile: 'Owed to you',
    rowSuffix: 'owes you',
    caps: (name: string) => `${name} owes you`,
    started: 'Lent',
    principal: 'Lent',
    repaid: 'Paid you back',
    more: 'Lend more',
    again: 'Lend again',
    settle: 'Paid back in full',
    repayTitle: (name: string) => `${name} paid you back`,
    moreTitle: (name: string) => `Lend to ${name}`,
    repayVerb: 'Record',
    moreVerb: 'Lend',
    principalWallet: 'Lent from',
    repayWallet: 'Paid into',
    /** Money leaves the wallet when this side's principal is recorded. */
    principalLeaves: true,
    owesAfter: (name: string, amount: string) => `${name} will owe you ${amount}`,
    stillOwes: (name: string, amount: string) => `${name} will still owe you ${amount}`,
    settles: (name: string) => `That settles it. ${name} will owe you nothing`,
    squareTitle: (name: string) => `All square with ${name}`,
    squareSentence: (name: string, amount: string) =>
      `${name} paid back all ${amount}. Moni moved this to Settled.`,
    writeOffBody: (name: string) =>
      `${name} won't owe you anything. No money moves, and this history stays.`,
    record: (name: string, amount: string) => `Record: ${name} owes you ${amount}`,
    saved: (name: string, amount: string) => `Saved. ${name} owes you ${amount}`,
    segment: (name: string) => `${name || 'They'} owe${name ? 's' : ''} me`,
    existing: (name: string, amount: string) =>
      `${name} already owes you ${amount}. This goes on ${name}'s page too.`,
  },
  i_owe: {
    tile: 'You owe',
    rowSuffix: 'you owe',
    caps: (name: string) => `You owe ${name}`,
    started: 'Borrowed',
    principal: 'Borrowed',
    repaid: 'You paid back',
    more: 'Borrow more',
    again: 'Borrow again',
    settle: 'I paid it all',
    repayTitle: (name: string) => `Pay ${name} back`,
    moreTitle: (name: string) => `Borrow from ${name}`,
    repayVerb: 'Pay',
    moreVerb: 'Borrow',
    principalWallet: 'Borrowed into',
    repayWallet: 'Paid from',
    principalLeaves: false,
    owesAfter: (name: string, amount: string) => `You will owe ${name} ${amount}`,
    stillOwes: (name: string, amount: string) => `You will still owe ${name} ${amount}`,
    settles: (name: string) => `That settles it. You will owe ${name} nothing`,
    squareTitle: (name: string) => `You and ${name} are square`,
    squareSentence: (_name: string, amount: string) =>
      `You paid back all ${amount}. Moni moved this to Settled.`,
    writeOffBody: (name: string) =>
      `You won't owe ${name} anything. No money moves, and this history stays.`,
    record: (name: string, amount: string) => `Record: you owe ${name} ${amount}`,
    saved: (name: string, amount: string) => `Saved. You owe ${name} ${amount}`,
    segment: (name: string) => `I owe ${name || 'them'}`,
    existing: (name: string, amount: string) =>
      `You already owe ${name} ${amount}. This goes on ${name}'s page too.`,
  },
} as const satisfies Record<DebtSide, unknown>;

/** "In 6 days", "Tomorrow", "Today", "2 days late". */
export function dueWords(daysLeft: number): string {
  if (daysLeft > 1) return `In ${daysLeft} days`;
  if (daysLeft === 1) return 'Tomorrow';
  if (daysLeft === 0) return 'Today';
  return daysLeft === -1 ? '1 day late' : `${-daysLeft} days late`;
}

/** Money on the Debts tab: "RM110" when it is whole ringgit, "RM25.50" when it is not. */
export function debtMoney(minor: number, currency: string): string {
  return formatMoney(minor, currency, { whole: minor % 100 === 0 });
}
