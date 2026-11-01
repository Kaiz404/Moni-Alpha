-- The capture a Review row absorbed when two alerts are one payment. Additive: until it is pushed
-- the app probes the column, and leaves both captures in Review with the "Maybe a duplicate" warning.
ALTER TABLE public.proposed_transactions
  ADD COLUMN IF NOT EXISTS pairing JSONB;

COMMENT ON COLUMN public.proposed_transactions.pairing IS 'The capture folded into this row and the columns it changed, for Undo. Ledger rows keep the same shape in metadata.pairing.';
