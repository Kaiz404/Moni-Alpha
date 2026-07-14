/**
 * Unit tests for default wallet + proposal currency resolution (no network).
 * Run: pnpm --filter moni test:default-wallet
 */

function resolveDefaultWalletId(wallets, storedId) {
  if (!storedId) return null;
  return wallets.some((w) => w.id === storedId) ? storedId : null;
}

function currencyForWallet(wallets, walletId) {
  if (!walletId) return null;
  const w = wallets.find((x) => x.id === walletId);
  if (!w?.currency) return null;
  const code = w.currency.trim().toUpperCase();
  return code.length === 3 ? code : null;
}

function normalizeCurrency(code) {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return normalized.length === 3 ? normalized : null;
}

function currenciesAlign(wallets, walletId, currency) {
  const walletCur = currencyForWallet(wallets, walletId);
  const proposalCur = normalizeCurrency(currency);
  if (!walletCur || !proposalCur) return true;
  return walletCur === proposalCur;
}

function displayCurrencyForProposal(proposal, wallets, defaultWalletId = null) {
  const proposalCur = normalizeCurrency(proposal.currency);
  const walletCur =
    currencyForWallet(wallets, proposal.walletId) ??
    currencyForWallet(wallets, defaultWalletId);

  if (walletCur && proposalCur && walletCur === proposalCur) {
    return walletCur;
  }
  if (proposalCur) return proposalCur;
  return walletCur ?? 'USD';
}

function resolveInitialWalletId(proposal, wallets, defaultWalletId) {
  if (proposal.walletId) return proposal.walletId;
  const defaultId = resolveDefaultWalletId(wallets, defaultWalletId);
  if (!defaultId) return null;
  if (currenciesAlign(wallets, defaultId, proposal.currency)) {
    return defaultId;
  }
  return null;
}

function applyDefaultWallet(proposal, candidateWallets, defaultWalletId) {
  if (proposal.walletId) return proposal;
  const resolved = resolveDefaultWalletId(candidateWallets, defaultWalletId);
  if (!resolved) return proposal;
  return { ...proposal, walletId: resolved };
}

function applyWalletCurrency(proposal, wallets, fallback = 'USD') {
  const currency = currencyForWallet(wallets, proposal.walletId) ?? fallback;
  return { ...proposal, currency };
}

function finalizeProposalWallet(proposal, wallets, defaultWalletId, options = {}) {
  let p = proposal;
  if (options.forceDefaultWallet) {
    p = { ...p, walletId: null, walletHint: null };
  }
  p = applyDefaultWallet(p, wallets, defaultWalletId);
  if (options.currencyFromWallet === false) {
    if (!currenciesAlign(wallets, p.walletId, p.currency)) {
      p = { ...p, walletId: null };
    }
  } else {
    p = applyWalletCurrency(p, wallets);
  }
  return p;
}

const wallets = [
  { id: 'a', name: 'Cash', currency: 'MYR' },
  { id: 'b', name: 'Maybank', currency: 'USD' },
];

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${message}`);
}

assert(resolveDefaultWalletId(wallets, 'a') === 'a', 'resolves valid stored id');
assert(resolveDefaultWalletId(wallets, 'missing') === null, 'rejects unknown id');
assert(resolveDefaultWalletId(wallets, null) === null, 'null stored id');

const withExisting = applyDefaultWallet({ walletId: 'b', amount: 10 }, wallets, 'a');
assert(withExisting.walletId === 'b', 'does not override inferred wallet');

const withDefault = applyDefaultWallet({ walletId: null, amount: 10 }, wallets, 'a');
assert(withDefault.walletId === 'a', 'applies default when wallet unset');

const notInCandidates = applyDefaultWallet({ walletId: null, amount: 10 }, [{ id: 'b' }], 'a');
assert(notInCandidates.walletId === null, 'default must be in candidate list');

const noDefault = applyDefaultWallet({ walletId: null, amount: 10 }, wallets, null);
assert(noDefault.walletId === null, 'no default leaves wallet unset');

const withCurrency = applyWalletCurrency({ walletId: 'b', currency: 'MYR' }, wallets);
assert(withCurrency.currency === 'USD', 'currency follows resolved wallet');

const textProposal = finalizeProposalWallet(
  { walletId: null, currency: 'MYR', amount: 10.4 },
  wallets,
  'a',
);
assert(textProposal.walletId === 'a', 'text flow applies default wallet');
assert(textProposal.currency === 'MYR', 'text flow currency from default wallet');

const receiptProposal = finalizeProposalWallet(
  { walletId: 'b', walletHint: 'Maybank', currency: 'USD', amount: 42 },
  wallets,
  'a',
  { forceDefaultWallet: true },
);
assert(receiptProposal.walletId === 'a', 'receipt flow forces default wallet');
assert(receiptProposal.walletHint === null, 'receipt flow clears wallet hint');
assert(receiptProposal.currency === 'MYR', 'receipt flow currency from default wallet');

const notificationMismatch = finalizeProposalWallet(
  { walletId: null, currency: 'SGD', amount: 5 },
  wallets,
  'a',
  { currencyFromWallet: false },
);
assert(notificationMismatch.walletId === null, 'notification clears wallet when currency mismatches default');
assert(notificationMismatch.currency === 'SGD', 'notification keeps AI currency');

const notificationMatch = finalizeProposalWallet(
  { walletId: null, currency: 'MYR', amount: 5 },
  wallets,
  'a',
  { currencyFromWallet: false },
);
assert(notificationMatch.walletId === 'a', 'notification keeps default wallet when currency matches');
assert(notificationMatch.currency === 'MYR', 'notification keeps AI currency when aligned');

assert(
  displayCurrencyForProposal({ walletId: 'a', currency: 'SGD' }, wallets, 'a') === 'SGD',
  'display prefers extracted currency when wallet disagrees',
);
assert(
  displayCurrencyForProposal({ walletId: 'a', currency: 'MYR' }, wallets, 'a') === 'MYR',
  'display uses wallet currency when aligned',
);
assert(
  resolveInitialWalletId({ walletId: null, currency: 'SGD' }, wallets, 'a') === null,
  'initial wallet skips default when currency mismatches',
);
assert(
  resolveInitialWalletId({ walletId: null, currency: 'MYR' }, wallets, 'a') === 'a',
  'initial wallet uses default when currency matches',
);

console.log(`default-wallet suite: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
