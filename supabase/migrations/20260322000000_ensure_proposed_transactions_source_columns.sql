-- Ensure proposed_transactions has the source columns introduced for
-- text and image input flows. This migration is idempotent (IF NOT EXISTS)
-- because version 20260320000000_extend_proposed_transactions ran its DDL
-- successfully but failed to record in schema_migrations due to a version
-- conflict, so those columns may already exist.

ALTER TABLE public.proposed_transactions
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'notification'
    CHECK (source_type IN ('notification', 'text', 'image'));

ALTER TABLE public.proposed_transactions
  ADD COLUMN IF NOT EXISTS source_text TEXT;

-- Starts as a local file:// URI, updated to a Supabase Storage URL after upload
ALTER TABLE public.proposed_transactions
  ADD COLUMN IF NOT EXISTS source_image_uri TEXT;
