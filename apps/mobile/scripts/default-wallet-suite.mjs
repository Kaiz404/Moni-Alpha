/**
 * Unit tests for default wallet resolution (no network).
 * Run: pnpm --filter moni test:default-wallet
 */

function resolveDefaultWalletId(wallets, storedId) {
  if (!storedId) return null;
  return wallets.some((w) => w.id === storedId) ? storedId : null;
}

function applyDefaultWallet(proposal, candidateWallets, defaultWalletId) {
  if (proposal.walletId) return proposal;
  const resolved = resolveDefaultWalletId(candidateWallets, defaultWalletId);
  if (!resolved) return proposal;
  return { ...proposal, walletId: resolved };
}

const wallets = [
  { id: 'a', name: 'Cash' },
  { id: 'b', name: 'Maybank' },
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

console.log(`default-wallet suite: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
