-- The ai_insights cache lost its last reader and writer when chat moved to /v1/chat/analyze.
-- Dropping the table also removes it from the supabase_realtime publication.
DROP TABLE IF EXISTS public.ai_insights;
