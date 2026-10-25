-- Review keeps reviewed proposals as history: Approve and Not mine stamp reviewed_at (and, for
-- Approve, the ledger row it created) instead of soft-deleting the row. The app soft-deletes rows
-- reviewed more than 90 days ago.
ALTER TABLE public.proposed_transactions
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

CREATE INDEX idx_proposed_transactions_user_reviewed
  ON public.proposed_transactions(user_id, reviewed_at DESC)
  WHERE reviewed_at IS NOT NULL AND deleted = false;
