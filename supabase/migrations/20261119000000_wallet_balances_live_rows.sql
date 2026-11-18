-- The view summed soft-deleted transactions and listed soft-deleted wallets, so its balances
-- disagreed with the phone, which skips both. It now counts only live rows, and income and expense
-- only on the wallet they belong to.
CREATE OR REPLACE VIEW public.wallet_balances WITH (security_invoker = true) AS
SELECT w.id,
  w.user_id,
  w.name,
  w.type,
  w.currency,
  w.initial_balance,
  w.color,
  w.icon,
  w.is_active,
  w.display_order,
  w.created_at,
  w.updated_at,
  w.initial_balance + COALESCE(sum(
    CASE
      WHEN t.type = 'income'::transaction_type AND t.wallet_id = w.id THEN t.amount
      WHEN t.type = 'expense'::transaction_type AND t.wallet_id = w.id THEN - t.amount
      WHEN t.type = 'transfer'::transaction_type AND t.wallet_id = w.id THEN - t.amount
      WHEN t.type = 'transfer'::transaction_type AND t.transfer_to_wallet_id = w.id THEN t.amount
      ELSE 0::numeric
    END), 0::numeric) AS current_balance
FROM public.wallets w
  LEFT JOIN public.transactions t
    ON (t.wallet_id = w.id OR t.transfer_to_wallet_id = w.id) AND t.deleted = false
WHERE w.is_active = true AND w.deleted = false
GROUP BY w.id;
REVOKE ALL ON public.wallet_balances FROM anon;
GRANT SELECT ON public.wallet_balances TO authenticated, service_role;
