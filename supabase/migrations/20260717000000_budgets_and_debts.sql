-- Currency-aware budgets and an offline-first person-to-person debt sub-ledger.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS currency CHAR(3),
  ADD COLUMN IF NOT EXISTS analysis_excluded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS debt_activity_id UUID;

UPDATE public.transactions t
SET currency = w.currency
FROM public.wallets w
WHERE t.wallet_id = w.id AND t.currency IS NULL;

UPDATE public.transactions SET currency = 'USD' WHERE currency IS NULL;
ALTER TABLE public.transactions ALTER COLUMN currency SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_user_currency_date
  ON public.transactions(user_id, currency, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_debt_activity
  ON public.transactions(debt_activity_id) WHERE debt_activity_id IS NOT NULL;

ALTER TABLE public.category_budgets ADD COLUMN IF NOT EXISTS currency CHAR(3);
UPDATE public.category_budgets b
SET currency = COALESCE(NULLIF(UPPER(p.preferences->>'currency'), ''), 'USD')
FROM public.profiles p
WHERE p.id = b.user_id AND b.currency IS NULL;
UPDATE public.category_budgets SET currency = 'USD' WHERE currency IS NULL;
ALTER TABLE public.category_budgets ALTER COLUMN currency SET NOT NULL;
ALTER TABLE public.category_budgets
  DROP CONSTRAINT IF EXISTS category_budgets_user_id_category_id_key;
ALTER TABLE public.category_budgets
  ADD CONSTRAINT category_budgets_user_category_currency_key UNIQUE(user_id, category_id, currency);

CREATE TYPE public.debt_direction AS ENUM ('owed_to_me', 'i_owe');
CREATE TYPE public.debt_status AS ENUM ('open', 'settled', 'written_off');
CREATE TYPE public.debt_activity_kind AS ENUM ('principal', 'repayment', 'write_off');

CREATE TABLE public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  counterparty_name TEXT NOT NULL CHECK (char_length(trim(counterparty_name)) > 0),
  direction public.debt_direction NOT NULL,
  currency CHAR(3) NOT NULL,
  due_date DATE,
  note TEXT,
  status public.debt_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted BOOLEAN NOT NULL DEFAULT false
);

-- References between this table and debt activities deliberately remain logical IDs.
-- Legend-State can upload related offline records in either order.
CREATE TABLE public.debt_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debt_id UUID NOT NULL,
  kind public.debt_activity_kind NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  activity_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  wallet_id UUID,
  cash_transaction_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT debt_activity_cash_shape CHECK (
    (kind = 'write_off' AND wallet_id IS NULL AND cash_transaction_id IS NULL)
    OR (kind IN ('principal', 'repayment') AND wallet_id IS NOT NULL AND cash_transaction_id IS NOT NULL)
  )
);

CREATE INDEX idx_debts_user_status ON public.debts(user_id, status) WHERE deleted = false;
CREATE INDEX idx_debts_user_due_date ON public.debts(user_id, due_date) WHERE deleted = false;
CREATE INDEX idx_debt_activities_user_debt_date ON public.debt_activities(user_id, debt_id, activity_date DESC) WHERE deleted = false;
CREATE INDEX idx_debt_activities_cash_transaction ON public.debt_activities(cash_transaction_id) WHERE cash_transaction_id IS NOT NULL;

CREATE TRIGGER update_debts_updated_at BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_debt_activities_updated_at BEFORE UPDATE ON public.debt_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own debts" ON public.debts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own debt activities" ON public.debt_activities FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.debts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.debt_activities;
