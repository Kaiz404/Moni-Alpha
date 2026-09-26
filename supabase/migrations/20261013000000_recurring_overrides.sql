-- User verdicts on recurring series the app detects on-device, and the time each wallet's
-- balance was last confirmed. Both feed the chat forecast; the detected series are never stored.

CREATE TABLE public.recurring_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'dismissed')),
  kind TEXT CHECK (kind IN ('income', 'bill', 'subscription')),
  expected_amount NUMERIC(12, 2) CHECK (expected_amount > 0),
  expected_day SMALLINT CHECK (expected_day BETWEEN 1 AND 31),
  currency CHAR(3) NOT NULL CHECK (btrim(currency) ~ '^[A-Z]{3}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted BOOLEAN NOT NULL DEFAULT false
);

-- Not unique: two offline devices can each write a verdict for a series; the newest wins on read.
CREATE INDEX idx_recurring_overrides_user_series ON public.recurring_overrides(user_id, series_key);

CREATE TRIGGER update_recurring_overrides_updated_at BEFORE UPDATE ON public.recurring_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.recurring_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own recurring overrides" ON public.recurring_overrides FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.recurring_overrides;

-- A wallet's opening balance was stated when it was created; the app stamps this on create and
-- on each save of the wallet screen (which shows the current balance). No default, so a
-- server-side insert never counts as a confirmation.
ALTER TABLE public.wallets ADD COLUMN balance_confirmed_at TIMESTAMPTZ;
UPDATE public.wallets SET balance_confirmed_at = created_at;
