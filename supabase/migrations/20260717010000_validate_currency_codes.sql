-- Repair legacy/offline debt rows, then prevent malformed currency codes such as "U".
WITH recovered_debt_currencies AS (
  SELECT DISTINCT ON (a.debt_id)
    a.debt_id,
    w.currency
  FROM public.debt_activities a
  JOIN public.wallets w ON w.id = a.wallet_id
  WHERE a.deleted = false
    AND a.wallet_id IS NOT NULL
    AND btrim(w.currency) ~ '^[A-Z]{3}$'
  ORDER BY a.debt_id, a.activity_date ASC
)
UPDATE public.debts d
SET currency = recovered.currency
FROM recovered_debt_currencies recovered
WHERE recovered.debt_id = d.id
  AND btrim(d.currency) !~ '^[A-Z]{3}$';

UPDATE public.debts d
SET currency = CASE
  WHEN btrim(p.preferences->>'currency') ~ '^[A-Za-z]{3}$' THEN upper(btrim(p.preferences->>'currency'))
  ELSE 'USD'
END
FROM public.profiles p
WHERE p.id = d.user_id
  AND btrim(d.currency) !~ '^[A-Z]{3}$';

UPDATE public.transactions SET currency = 'USD'
WHERE btrim(currency) !~ '^[A-Z]{3}$';
UPDATE public.category_budgets SET currency = 'USD'
WHERE btrim(currency) !~ '^[A-Z]{3}$';

ALTER TABLE public.debts
  ADD CONSTRAINT debts_currency_iso_code CHECK (btrim(currency) ~ '^[A-Z]{3}$');
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_currency_iso_code CHECK (btrim(currency) ~ '^[A-Z]{3}$');
ALTER TABLE public.category_budgets
  ADD CONSTRAINT category_budgets_currency_iso_code CHECK (btrim(currency) ~ '^[A-Z]{3}$');
