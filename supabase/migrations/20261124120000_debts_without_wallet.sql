-- A debt can be a record only: a principal or repayment may move no money, so it has no wallet
-- and no cash mirror. Cash, when it moves, still needs both.
ALTER TABLE public.debt_activities DROP CONSTRAINT debt_activity_cash_shape;
ALTER TABLE public.debt_activities ADD CONSTRAINT debt_activity_cash_shape CHECK (
  (kind = 'write_off' AND wallet_id IS NULL AND cash_transaction_id IS NULL)
  OR (kind IN ('principal', 'repayment') AND (wallet_id IS NULL) = (cash_transaction_id IS NULL))
);
