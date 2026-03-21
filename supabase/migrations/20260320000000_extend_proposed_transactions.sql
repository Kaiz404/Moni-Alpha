-- Extend proposed_transactions to support text and image input sources
-- in addition to the original push-notification source.

ALTER TABLE public.proposed_transactions
  ADD COLUMN source_type TEXT NOT NULL DEFAULT 'notification'
    CHECK (source_type IN ('notification', 'text', 'image'));

ALTER TABLE public.proposed_transactions
  ADD COLUMN source_text TEXT;

-- Starts as a local file:// URI, updated to a Supabase Storage URL after upload
ALTER TABLE public.proposed_transactions
  ADD COLUMN source_image_uri TEXT;
