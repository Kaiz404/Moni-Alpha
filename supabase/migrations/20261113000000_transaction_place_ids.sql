-- Google place IDs on transactions, and when Google's coordinates were fetched.
-- Google allows a place ID to be kept indefinitely, and Places coordinates for 30 days only.
-- A row with place_coords_at set holds Google's coordinates: the app refreshes them by place ID
-- or clears them before 30 days pass. A null place_coords_at means the coordinates are the
-- user's own (the phone's position or a spot they pinned), kept like any other row.
-- Additive: the app probes transactions.place_id and writes neither column until it is found.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS place_id TEXT,
  ADD COLUMN IF NOT EXISTS place_coords_at TIMESTAMPTZ;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_place_coords_need_place_id;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_place_coords_need_place_id
  CHECK (place_coords_at IS NULL OR place_id IS NOT NULL);

