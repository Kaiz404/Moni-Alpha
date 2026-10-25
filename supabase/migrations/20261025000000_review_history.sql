-- The app soft-deletes rows reviewed more than 90 days ago (pruneReviewHistory).
ALTER TABLE public.proposed_transactions
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

CREATE INDEX idx_proposed_transactions_user_reviewed
  ON public.proposed_transactions(user_id, reviewed_at DESC)
  WHERE reviewed_at IS NOT NULL AND deleted = false;
