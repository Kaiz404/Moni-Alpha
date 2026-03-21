-- Ensure transaction location columns exist on current Supabase environments
-- This migration is idempotent and safe to run even if columns already exist.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS location_latitude NUMERIC(10, 8),
  ADD COLUMN IF NOT EXISTS location_longitude NUMERIC(11, 8),
  ADD COLUMN IF NOT EXISTS location_name TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_location_complete'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT check_location_complete CHECK (
        (location_latitude IS NULL AND location_longitude IS NULL)
        OR (location_latitude IS NOT NULL AND location_longitude IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_user_location
  ON public.transactions(user_id, location_latitude, location_longitude);
