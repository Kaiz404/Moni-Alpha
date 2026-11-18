-- The record of each user's AI choice (#57). Every change is a new row and nothing is ever
-- updated, so the history is the consent record and two devices changing different switches
-- never overwrite each other. `use` is `all` for the master switch "Let Moni use AI", or one
-- use: `alerts`, `add`, `receipts`, `chat`. The newest row per use is the current choice.
CREATE TABLE public.ai_consents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  use text NOT NULL CHECK (use IN ('all', 'alerts', 'add', 'receipts', 'chat')),
  granted boolean NOT NULL,
  -- Which wording of the notice the user saw, e.g. 2026-11-19.
  notice_version text NOT NULL CHECK (notice_version ~ '^\d{4}-\d{2}-\d{2}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_consents_current ON public.ai_consents (user_id, use, created_at DESC, id DESC);

ALTER TABLE public.ai_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own consent rows are readable" ON public.ai_consents
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Own consent rows can be added" ON public.ai_consents
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

-- Append only, and the server sets the time: a client may name only these columns.
REVOKE ALL ON public.ai_consents FROM anon, authenticated;
GRANT SELECT ON public.ai_consents TO authenticated;
GRANT INSERT (user_id, use, granted, notice_version) ON public.ai_consents TO authenticated;

CREATE VIEW public.ai_consent_current WITH (security_invoker = true) AS
SELECT DISTINCT ON (user_id, use) user_id, use, granted, notice_version, created_at
FROM public.ai_consents
ORDER BY user_id, use, created_at DESC, id DESC;

REVOKE ALL ON public.ai_consent_current FROM anon, authenticated;
GRANT SELECT ON public.ai_consent_current TO authenticated;
