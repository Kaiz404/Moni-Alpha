-- Supabase Realtime delivers a CHAR(3) value cast to one character, so MYR reaches a phone as M. The
-- phone stores it, shows M23.40, drops the row from ringgit totals, and sends it back on its next
-- edit. TEXT reaches the phone whole. Measured on the dev project on 1 Nov 2026.

-- The view depends on wallets.currency. It never set security_invoker, so it ran as its owner and
-- bypassed RLS on wallets and transactions. It comes back reading as the caller.
DROP VIEW public.wallet_balances;

ALTER TABLE public.wallets
  ALTER COLUMN currency DROP DEFAULT,
  ALTER COLUMN currency TYPE TEXT USING btrim(currency),
  ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE public.proposed_transactions
  ALTER COLUMN currency DROP DEFAULT,
  ALTER COLUMN currency TYPE TEXT USING btrim(currency),
  ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE public.transactions ALTER COLUMN currency TYPE TEXT USING btrim(currency);
ALTER TABLE public.debts ALTER COLUMN currency TYPE TEXT USING btrim(currency);
ALTER TABLE public.category_budgets ALTER COLUMN currency TYPE TEXT USING btrim(currency);
ALTER TABLE public.recurring_overrides ALTER COLUMN currency TYPE TEXT USING btrim(currency);

CREATE VIEW public.wallet_balances WITH (security_invoker = true) AS
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
      WHEN t.type = 'income'::transaction_type THEN t.amount
      WHEN t.type = 'expense'::transaction_type THEN - t.amount
      WHEN t.type = 'transfer'::transaction_type AND t.wallet_id = w.id THEN - t.amount
      WHEN t.type = 'transfer'::transaction_type AND t.transfer_to_wallet_id = w.id THEN t.amount
      ELSE 0::numeric
    END), 0::numeric) AS current_balance
FROM public.wallets w
  LEFT JOIN public.transactions t ON t.wallet_id = w.id OR t.transfer_to_wallet_id = w.id
WHERE w.is_active = true
GROUP BY w.id;
REVOKE ALL ON public.wallet_balances FROM anon;
GRANT SELECT ON public.wallet_balances TO authenticated, service_role;

-- Repair what the truncation wrote back. Only wallets and captures had no check to refuse it. A
-- transaction's currency is checked, so it is the wallet's truth; then the user's main currency if
-- its first letter agrees.
UPDATE public.wallets w
SET currency = t.currency
FROM (
  SELECT DISTINCT ON (wallet_id) wallet_id, currency
  FROM public.transactions
  WHERE deleted = false
  ORDER BY wallet_id, transaction_date DESC
) t
WHERE t.wallet_id = w.id AND w.currency !~ '^[A-Z]{3}$';

UPDATE public.wallets w
SET currency = p.preferences->>'currency'
FROM public.profiles p
WHERE p.id = w.user_id
  AND w.currency !~ '^[A-Z]{3}$'
  AND left(p.preferences->>'currency', 1) = w.currency;

UPDATE public.proposed_transactions c
SET currency = w.currency
FROM public.wallets w
WHERE w.id = c.wallet_id AND c.currency !~ '^[A-Z]{3}$' AND w.currency ~ '^[A-Z]{3}$';

UPDATE public.proposed_transactions c
SET currency = p.preferences->>'currency'
FROM public.profiles p
WHERE p.id = c.user_id
  AND c.currency !~ '^[A-Z]{3}$'
  AND left(p.preferences->>'currency', 1) = c.currency;

-- NOT VALID so a row this repair could not settle does not block the migration. New writes are checked.
ALTER TABLE public.wallets
  ADD CONSTRAINT wallets_currency_iso_code CHECK (currency ~ '^[A-Z]{3}$') NOT VALID;
ALTER TABLE public.proposed_transactions
  ADD CONSTRAINT proposed_transactions_currency_iso_code CHECK (currency ~ '^[A-Z]{3}$') NOT VALID;

-- Phones pull rows changed since their last sync, so a phone holding a truncated row would keep it.
-- Touching every row brings each phone the whole value once.
UPDATE public.wallets SET updated_at = now();
UPDATE public.proposed_transactions SET updated_at = now();
UPDATE public.transactions SET updated_at = now();
UPDATE public.debts SET updated_at = now();
UPDATE public.category_budgets SET updated_at = now();
UPDATE public.recurring_overrides SET updated_at = now();
