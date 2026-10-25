-- The dev project recorded 20260712000000 as applied without these columns, so
-- transfer proposals failed with 42703. Re-adding is a no-op where they exist.

ALTER TABLE public.proposed_transactions
  ADD COLUMN IF NOT EXISTS transfer_to_wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transfer_to_wallet_hint TEXT;

COMMENT ON COLUMN public.proposed_transactions.transfer_to_wallet_id IS 'Resolved destination wallet when type is transfer';
COMMENT ON COLUMN public.proposed_transactions.transfer_to_wallet_hint IS 'LLM hint for destination wallet name when transfer_to_wallet_id is unresolved';
