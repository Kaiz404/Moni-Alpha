-- QR sign-in requests. Only the Edge Functions qr-start, qr-approve and qr-poll touch this table,
-- with the secret key; clients have no grant and no policy.
CREATE TABLE public.qr_sign_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SHA-256 of the secret the web polls with; the secret itself never lands here.
  poll_secret_hash TEXT NOT NULL UNIQUE,
  -- The code in the QR. It rotates every minute while the request waits.
  code TEXT NOT NULL UNIQUE,
  code_expires_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  -- "Chrome on Windows", from the requesting browser's User-Agent, for the phone's question.
  browser TEXT NOT NULL,
  -- SHA-256 of the requesting address, for the per-address limit on qr-start.
  ip_hash TEXT NOT NULL,
  -- Set together when the phone approves: who signs in, and the magic-link token hash the web
  -- redeems with verifyOtp. qr-poll hands the hash out once and deletes the row.
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qr_sign_ins_approved_together CHECK ((user_id IS NULL) = (token_hash IS NULL))
);

CREATE INDEX qr_sign_ins_ip_recent ON public.qr_sign_ins (ip_hash, created_at);
CREATE INDEX qr_sign_ins_expires ON public.qr_sign_ins (expires_at);

ALTER TABLE public.qr_sign_ins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qr_sign_ins FROM anon, authenticated;
