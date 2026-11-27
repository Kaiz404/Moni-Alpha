import { type DebtSide, formatMoney } from '@repo/core';

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
    noted: 'Noted',
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
    principalNone: "Money didn't leave my wallet",
    repayNone: "Money didn't reach my wallet",
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
    saved: (name: string, amount: string) => `Saved. ${name} owes you ${amount}`,
    segment: 'They owe me',
    pastPeople: 'People who owed you',
  },
  i_owe: {
    tile: 'You owe',
    rowSuffix: 'you owe',
    caps: (name: string) => `You owe ${name}`,
    started: 'Borrowed',
    noted: 'Noted',
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
    principalNone: "Money didn't reach my wallet",
    repayNone: "Money didn't leave my wallet",
    principalLeaves: false,
    owesAfter: (name: string, amount: string) => `You will owe ${name} ${amount}`,
    stillOwes: (name: string, amount: string) => `You will still owe ${name} ${amount}`,
    settles: (name: string) => `That settles it. You will owe ${name} nothing`,
    squareTitle: (name: string) => `You and ${name} are square`,
    squareSentence: (_name: string, amount: string) =>
      `You paid back all ${amount}. Moni moved this to Settled.`,
    writeOffBody: (name: string) =>
      `You won't owe ${name} anything. No money moves, and this history stays.`,
    saved: (name: string, amount: string) => `Saved. You owe ${name} ${amount}`,
    segment: 'I owe them',
    pastPeople: 'People you owed',
  },
} as const satisfies Record<DebtSide, unknown>;

/** Money on the Debts tab: "RM110" when it is whole ringgit, "RM25.50" when it is not. */
export function debtMoney(minor: number, currency: string): string {
  return formatMoney(minor, currency, { whole: minor % 100 === 0 });
}
