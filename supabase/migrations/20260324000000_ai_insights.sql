-- AI-generated finance insights (on-device LLM + deterministic metrics).
-- Extensible: feature_key + context_key identify the "slot"; result JSON holds feature-specific payloads.

CREATE TABLE public.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL DEFAULT 'summary_insight_cards',
  context_key TEXT NOT NULL DEFAULT 'global',
  schema_version INTEGER NOT NULL DEFAULT 1,
  input_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'error')),
  tool_snapshot JSONB,
  result JSONB,
  error_message TEXT,
  model_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature_key, context_key)
);

CREATE INDEX idx_ai_insights_user_id ON public.ai_insights(user_id);
CREATE INDEX idx_ai_insights_user_feature ON public.ai_insights(user_id, feature_key);

CREATE TRIGGER update_ai_insights_updated_at
  BEFORE UPDATE ON public.ai_insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own ai insights"
  ON public.ai_insights
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
