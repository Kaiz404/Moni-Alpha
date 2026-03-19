-- Proposed Transactions
-- Stores AI-detected transaction proposals from push notifications.
-- Users review and approve/reject each proposal before a real transaction is created.

CREATE TABLE public.proposed_transactions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Source push notification metadata
  source_app                TEXT,
  notification_title        TEXT,
  notification_body         TEXT,
  notification_received_at  TIMESTAMPTZ,

  -- AI analysis
  ai_reasoning              TEXT,
  ai_confidence             DECIMAL(3,2) CHECK (ai_confidence BETWEEN 0 AND 1),

  -- Proposed transaction fields (nullable — AI may be uncertain about some)
  wallet_id                 UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  wallet_hint               TEXT,           -- e.g. "bank", "ewallet" when wallet_id unknown
  amount                    DECIMAL(12,2),
  currency                  CHAR(3) NOT NULL DEFAULT 'USD',
  type                      transaction_type,
  description               TEXT,
  merchant                  TEXT,
  category_id               UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  category_hint             TEXT,           -- e.g. "food", "transport" when category_id unknown
  transaction_date          TIMESTAMPTZ,

  -- Lifecycle
  status                    TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected')),

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_proposed_transactions_user_id
  ON public.proposed_transactions(user_id);
CREATE INDEX idx_proposed_transactions_user_status
  ON public.proposed_transactions(user_id, status);

-- Auto-update updated_at
CREATE TRIGGER update_proposed_transactions_updated_at
  BEFORE UPDATE ON public.proposed_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row-level security
ALTER TABLE public.proposed_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own proposed transactions"
  ON public.proposed_transactions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
