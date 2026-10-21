-- Review deck: "Later" snoozes a proposal until snoozed_until, and "Don't ask about similar"
-- stores an auto-add rule. Both are additive: builds that predate them ignore the new column and
-- table, and show a 'later' row as pending.

ALTER TABLE public.proposed_transactions DROP CONSTRAINT proposed_transactions_status_check;
ALTER TABLE public.proposed_transactions ADD CONSTRAINT proposed_transactions_status_check
  CHECK (status IN ('pending', 'later', 'rejected', 'approved'));
ALTER TABLE public.proposed_transactions ADD COLUMN snoozed_until TIMESTAMPTZ;

CREATE TABLE public.auto_add_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_key TEXT NOT NULL CHECK (merchant_key ~ '^[a-z]+( [a-z]+)*$'),
  source_app TEXT NOT NULL CHECK (btrim(source_app) <> ''),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted BOOLEAN NOT NULL DEFAULT false
);

-- Not unique: two offline devices can each write a rule for the same alert; the newest wins on read.
CREATE INDEX idx_auto_add_rules_user_match
  ON public.auto_add_rules(user_id, source_app, merchant_key);

CREATE TRIGGER update_auto_add_rules_updated_at BEFORE UPDATE ON public.auto_add_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.auto_add_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own auto-add rules" ON public.auto_add_rules FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.auto_add_rules;
