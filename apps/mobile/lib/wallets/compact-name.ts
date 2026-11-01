const ACCOUNT_KIND =
  /[\s\-–—·:,]+(?:savings?|current|account|acct|e[\s-]?wallet|wallet)$/i;

/** "Maybank Savings Account" reads "Maybank"; a name that is only a kind, like "Savings", stays. */
export function compactWalletName(name: string): string {
  let compact = name.trim();
  for (;;) {
    const next = compact.replace(ACCOUNT_KIND, '');
    if (next === compact || !next) return compact;
    compact = next;
  }
}

/**
 * Wallet id to the name rows and chips show. Pass every wallet the user has: two that would read
 * the same, such as Maybank Savings and Maybank Current, both keep their full names.
 */
export function compactWalletNames(
  wallets: readonly { id: string; name: string }[],
): Record<string, string> {
  const readers = new Map<string, number>();
  const key = (name: string) => compactWalletName(name).toLowerCase();
  for (const wallet of wallets) {
    readers.set(key(wallet.name), (readers.get(key(wallet.name)) ?? 0) + 1);
  }
  return Object.fromEntries(
    wallets.map((wallet) => [
      wallet.id,
      readers.get(key(wallet.name)) === 1 ? compactWalletName(wallet.name) : wallet.name,
    ]),
  );
}
