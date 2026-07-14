-- Per-wallet card gradient style, chosen from a curated frontend preset list
-- (apps/mobile/constants/wallet-card-styles.ts). Additive/non-breaking; the
-- preset registry itself lives in the client so new styles ship without a migration.
ALTER TABLE wallets
  ADD COLUMN card_style_id TEXT NOT NULL DEFAULT 'emerald-grain';

COMMENT ON COLUMN wallets.card_style_id IS
  'Id of a wallet card gradient preset from apps/mobile/constants/wallet-card-styles.ts';
