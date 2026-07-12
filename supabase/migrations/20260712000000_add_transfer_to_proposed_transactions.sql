-- Transfer fields on AI proposals (destination wallet for type = transfer)

ALTER TABLE public.proposed_transactions
  ADD COLUMN IF NOT EXISTS transfer_to_wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transfer_to_wallet_hint TEXT;

COMMENT ON COLUMN public.proposed_transactions.transfer_to_wallet_id IS 'Resolved destination wallet when type is transfer';
COMMENT ON COLUMN public.proposed_transactions.transfer_to_wallet_hint IS 'LLM hint for destination wallet name when transfer_to_wallet_id is unresolved';
