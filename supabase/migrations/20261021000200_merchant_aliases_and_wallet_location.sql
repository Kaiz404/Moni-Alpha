-- Merchant names the user gives raw alert merchants, and a per-wallet switch for recording where
-- notification payments happen. Both are additive; builds that predate them ignore them.

CREATE TABLE public.merchant_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_key TEXT NOT NULL CHECK (raw_key ~ '^[a-z]+( [a-z]+)*$'),
  display_name TEXT NOT NULL CHECK (btrim(display_name) <> '' AND char_length(display_name) <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted BOOLEAN NOT NULL DEFAULT false
);

-- Not unique: two offline devices can each name a merchant; the newest wins on read.
CREATE INDEX idx_merchant_aliases_user_key ON public.merchant_aliases(user_id, raw_key);

CREATE TRIGGER update_merchant_aliases_updated_at BEFORE UPDATE ON public.merchant_aliases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.merchant_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own merchant aliases" ON public.merchant_aliases FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_aliases;

-- The app writes this column only once it has found merchant_aliases, which this same migration
-- creates.
ALTER TABLE public.wallets ADD COLUMN record_location BOOLEAN NOT NULL DEFAULT true;
