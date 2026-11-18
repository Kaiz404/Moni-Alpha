-- Custom Access Token Hook: every access token carries `ai_consent`, the user's current master
-- AI switch, so the stateless Go backend can refuse AI calls without a database. A user who was
-- never asked gets no claim at all, which older app builds rely on while they roll out.
-- Enabled in the dashboard or the Management API (supabase/README.md), not by this migration.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  master boolean;
BEGIN
  SELECT c.granted INTO master
  FROM public.ai_consents c
  WHERE c.user_id = (event ->> 'user_id')::uuid AND c.use = 'all'
  ORDER BY c.created_at DESC, c.id DESC
  LIMIT 1;

  IF master IS NULL THEN
    RETURN event;
  END IF;
  RETURN jsonb_set(event, '{claims,ai_consent}', to_jsonb(master));
EXCEPTION WHEN OTHERS THEN
  -- A failing hook fails every sign-in and refresh. Without the claim the backend still decides.
  RAISE WARNING 'custom_access_token_hook: %', SQLERRM;
  RETURN event;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;

GRANT SELECT ON public.ai_consents TO supabase_auth_admin;
CREATE POLICY "Auth reads consent for the token claim" ON public.ai_consents
  FOR SELECT TO supabase_auth_admin USING (true);
