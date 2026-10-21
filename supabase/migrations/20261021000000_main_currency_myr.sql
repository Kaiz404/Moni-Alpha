-- The main currency becomes MYR. No client has ever offered a currency choice, so a stored
-- 'USD' is the old column default, not a decision; rewrite it along with the default.

ALTER TABLE public.profiles ALTER COLUMN preferences SET DEFAULT '{
  "currency": "MYR",
  "theme": "system",
  "notifications_enabled": true
}'::jsonb;

UPDATE public.profiles
SET preferences = jsonb_set(preferences, '{currency}', '"MYR"')
WHERE preferences->>'currency' = 'USD';
