-- Bills are confirmed recurring_overrides rows (kind bill or subscription), with or without a
-- detected series. These columns hold what the bill page edits. All are additive with
-- defaults, so an installed app that never sends them keeps syncing.
ALTER TABLE public.recurring_overrides
  ADD COLUMN skip_period TEXT NULL CHECK (skip_period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  ADD COLUMN remind BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN name TEXT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 30),
  ADD COLUMN wallet_id UUID NULL REFERENCES public.wallets(id) ON DELETE SET NULL,
  ADD COLUMN category_id UUID NULL REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN due_once DATE NULL;

COMMENT ON COLUMN public.recurring_overrides.skip_period IS 'YYYY-MM the bill is skipped for.';
COMMENT ON COLUMN public.recurring_overrides.remind IS 'Remind the day before the bill is due.';
COMMENT ON COLUMN public.recurring_overrides.due_once IS 'Date of a bill due once; null for a monthly bill.';
