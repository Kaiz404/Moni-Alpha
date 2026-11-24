-- Two users, A and B, each write their own rows, then B points rows at A's IDs. Every own-row write
-- the apps make must pass and every cross-user reference must be refused (issue #121,
-- 20261124130000_owned_references.sql). Runs in one transaction that rolls back, so it is safe on
-- the dev project. How to run: supabase/README.md § Tests.

BEGIN;

INSERT INTO auth.users (id, email, aud, role) VALUES
  ('a0000000-0000-4000-8000-000000000000', 'owned-refs-a@example.invalid', 'authenticated', 'authenticated'),
  ('b0000000-0000-4000-8000-000000000000', 'owned-refs-b@example.invalid', 'authenticated', 'authenticated');

CREATE TEMP TABLE system_category ON COMMIT DROP AS
  SELECT id FROM public.categories WHERE user_id IS NULL AND type = 'expense' LIMIT 1;
GRANT SELECT ON system_category TO authenticated;

SET LOCAL ROLE authenticated;

-- A writes the rows the apps write: own wallets, a custom and a system category, a transfer, tags,
-- a capture, budgets, a debt with and without cash, a bill and an auto-add rule.
SET LOCAL request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000000","role":"authenticated"}';

INSERT INTO public.wallets (id, user_id, name, type, currency, color, icon) VALUES
  ('a0000000-0000-4000-8000-000000000001', auth.uid(), 'A main', 'bank', 'MYR', '#7CD76C', 'bank'),
  ('a0000000-0000-4000-8000-000000000002', auth.uid(), 'A cash', 'cash', 'MYR', '#7CD76C', 'cash'),
  ('a0000000-0000-4000-8000-000000000003', auth.uid(), 'A dollars', 'bank', 'USD', '#7CD76C', 'bank');
INSERT INTO public.categories (id, user_id, name, type, color, icon) VALUES
  ('a0000000-0000-4000-8000-000000000004', auth.uid(), 'Owned refs A', 'expense', '#7CD76C', 'coffee');
INSERT INTO public.tags (id, user_id, name, color) VALUES
  ('a0000000-0000-4000-8000-000000000005', auth.uid(), 'a-tag', '#7CD76C');
INSERT INTO public.transactions (id, user_id, wallet_id, amount, currency, type, category_id) VALUES
  ('a0000000-0000-4000-8000-000000000006', auth.uid(), 'a0000000-0000-4000-8000-000000000001', 10, 'MYR', 'expense', (SELECT id FROM system_category)),
  ('a0000000-0000-4000-8000-000000000012', auth.uid(), 'a0000000-0000-4000-8000-000000000001', 12, 'MYR', 'expense', 'a0000000-0000-4000-8000-000000000004');
INSERT INTO public.transactions (id, user_id, wallet_id, transfer_to_wallet_id, amount, currency, type) VALUES
  ('a0000000-0000-4000-8000-000000000007', auth.uid(), 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 5, 'MYR', 'transfer');
INSERT INTO public.transaction_tags (id, user_id, transaction_id, tag_id) VALUES
  ('a0000000-0000-4000-8000-00000000000c', auth.uid(), 'a0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000005');
INSERT INTO public.proposed_transactions (id, user_id, wallet_id, category_id, transaction_id, status) VALUES
  ('a0000000-0000-4000-8000-00000000000d', auth.uid(), 'a0000000-0000-4000-8000-000000000001', (SELECT id FROM system_category), 'a0000000-0000-4000-8000-000000000006', 'approved');
INSERT INTO public.category_budgets (id, user_id, category_id, amount, currency) VALUES
  ('a0000000-0000-4000-8000-00000000000e', auth.uid(), (SELECT id FROM system_category), 100, 'MYR'),
  ('a0000000-0000-4000-8000-00000000000f', auth.uid(), 'a0000000-0000-4000-8000-000000000004', 100, 'MYR');

-- Legend-State may upload an activity before its debt: the debt arrives after.
INSERT INTO public.debt_activities (id, user_id, debt_id, kind, amount) VALUES
  ('a0000000-0000-4000-8000-000000000009', auth.uid(), 'a0000000-0000-4000-8000-000000000008', 'principal', 20);
INSERT INTO public.debts (id, user_id, counterparty_name, direction, currency) VALUES
  ('a0000000-0000-4000-8000-000000000008', auth.uid(), 'Sam', 'owed_to_me', 'MYR');
INSERT INTO public.transactions (id, user_id, wallet_id, amount, currency, type, debt_activity_id, analysis_excluded) VALUES
  ('a0000000-0000-4000-8000-00000000000a', auth.uid(), 'a0000000-0000-4000-8000-000000000001', 30, 'MYR', 'expense', 'a0000000-0000-4000-8000-00000000000b', true);
INSERT INTO public.debt_activities (id, user_id, debt_id, kind, amount, wallet_id, cash_transaction_id) VALUES
  ('a0000000-0000-4000-8000-00000000000b', auth.uid(), 'a0000000-0000-4000-8000-000000000008', 'principal', 30, 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a');
INSERT INTO public.recurring_overrides (id, user_id, series_key, status, currency, kind, wallet_id, category_id) VALUES
  ('a0000000-0000-4000-8000-000000000010', auth.uid(), 'MYR|expense|netflix', 'confirmed', 'MYR', 'bill', 'a0000000-0000-4000-8000-000000000001', (SELECT id FROM system_category));
INSERT INTO public.auto_add_rules (id, user_id, source_app, merchant_key, wallet_id, category_id) VALUES
  ('a0000000-0000-4000-8000-000000000011', auth.uid(), 'com.bank', 'kopi tiam', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004');

-- The sync's upsert and an edit of an own row pass.
INSERT INTO public.transactions (id, user_id, wallet_id, amount, currency, type, category_id) VALUES
  ('a0000000-0000-4000-8000-000000000006', auth.uid(), 'a0000000-0000-4000-8000-000000000002', 11, 'MYR', 'expense', 'a0000000-0000-4000-8000-000000000004')
  ON CONFLICT (id) DO UPDATE SET wallet_id = excluded.wallet_id, amount = excluded.amount, category_id = excluded.category_id;
UPDATE public.transactions SET deleted = true WHERE id = 'a0000000-0000-4000-8000-000000000012';

-- A transfer between currencies is refused, on insert and on edit.
DO $$
DECLARE
  stmt text;
BEGIN
  FOREACH stmt IN ARRAY ARRAY[
    $q$INSERT INTO public.transactions (user_id, wallet_id, transfer_to_wallet_id, amount, currency, type)
       VALUES (auth.uid(), 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 5, 'MYR', 'transfer')$q$,
    $q$UPDATE public.transactions SET transfer_to_wallet_id = 'a0000000-0000-4000-8000-000000000003'
       WHERE id = 'a0000000-0000-4000-8000-000000000007'$q$
  ] LOOP
    BEGIN
      EXECUTE stmt;
      RAISE EXCEPTION 'not refused: %', stmt;
    EXCEPTION WHEN check_violation THEN
      IF SQLERRM NOT LIKE '%same currency%' THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

-- B writes its own rows, including one under a system category.
SET LOCAL request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000000","role":"authenticated"}';

INSERT INTO public.wallets (id, user_id, name, type, currency, color, icon) VALUES
  ('b0000000-0000-4000-8000-000000000001', auth.uid(), 'B main', 'bank', 'MYR', '#7CD76C', 'bank');
INSERT INTO public.categories (id, user_id, name, type, color, icon) VALUES
  ('b0000000-0000-4000-8000-000000000004', auth.uid(), 'Owned refs B', 'expense', '#7CD76C', 'coffee');
INSERT INTO public.tags (id, user_id, name, color) VALUES
  ('b0000000-0000-4000-8000-000000000005', auth.uid(), 'b-tag', '#7CD76C');
INSERT INTO public.transactions (id, user_id, wallet_id, amount, currency, type, category_id) VALUES
  ('b0000000-0000-4000-8000-000000000006', auth.uid(), 'b0000000-0000-4000-8000-000000000001', 10, 'MYR', 'expense', (SELECT id FROM system_category));
INSERT INTO public.debts (id, user_id, counterparty_name, direction, currency) VALUES
  ('b0000000-0000-4000-8000-000000000008', auth.uid(), 'Ali', 'i_owe', 'MYR');
INSERT INTO public.debt_activities (id, user_id, debt_id, kind, amount) VALUES
  ('b0000000-0000-4000-8000-000000000009', auth.uid(), 'b0000000-0000-4000-8000-000000000008', 'principal', 20);

-- B points rows at A's IDs: every one is refused.
DO $$
DECLARE
  stmt text;
BEGIN
  FOREACH stmt IN ARRAY ARRAY[
    $q$INSERT INTO public.transactions (user_id, wallet_id, amount, currency, type)
       VALUES (auth.uid(), 'a0000000-0000-4000-8000-000000000001', 1, 'MYR', 'expense')$q$,
    $q$INSERT INTO public.transactions (user_id, wallet_id, transfer_to_wallet_id, amount, currency, type)
       VALUES (auth.uid(), 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 1, 'MYR', 'transfer')$q$,
    $q$INSERT INTO public.transactions (user_id, wallet_id, amount, currency, type, category_id)
       VALUES (auth.uid(), 'b0000000-0000-4000-8000-000000000001', 1, 'MYR', 'expense', 'a0000000-0000-4000-8000-000000000004')$q$,
    $q$INSERT INTO public.transactions (user_id, wallet_id, amount, currency, type, linked_transaction_id)
       VALUES (auth.uid(), 'b0000000-0000-4000-8000-000000000001', 1, 'MYR', 'expense', 'a0000000-0000-4000-8000-000000000006')$q$,
    $q$INSERT INTO public.transactions (user_id, wallet_id, amount, currency, type, debt_activity_id)
       VALUES (auth.uid(), 'b0000000-0000-4000-8000-000000000001', 1, 'MYR', 'expense', 'a0000000-0000-4000-8000-000000000009')$q$,
    $q$INSERT INTO public.transaction_tags (user_id, transaction_id, tag_id)
       VALUES (auth.uid(), 'b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000005')$q$,
    $q$INSERT INTO public.transaction_tags (user_id, transaction_id, tag_id)
       VALUES (auth.uid(), 'a0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000005')$q$,
    $q$INSERT INTO public.proposed_transactions (user_id, wallet_id) VALUES (auth.uid(), 'a0000000-0000-4000-8000-000000000001')$q$,
    $q$INSERT INTO public.proposed_transactions (user_id, transfer_to_wallet_id) VALUES (auth.uid(), 'a0000000-0000-4000-8000-000000000002')$q$,
    $q$INSERT INTO public.proposed_transactions (user_id, category_id) VALUES (auth.uid(), 'a0000000-0000-4000-8000-000000000004')$q$,
    $q$INSERT INTO public.proposed_transactions (user_id, transaction_id) VALUES (auth.uid(), 'a0000000-0000-4000-8000-000000000006')$q$,
    $q$INSERT INTO public.category_budgets (user_id, category_id, amount, currency)
       VALUES (auth.uid(), 'a0000000-0000-4000-8000-000000000004', 1, 'MYR')$q$,
    $q$INSERT INTO public.debt_activities (user_id, debt_id, kind, amount)
       VALUES (auth.uid(), 'a0000000-0000-4000-8000-000000000008', 'repayment', 1)$q$,
    $q$INSERT INTO public.debt_activities (user_id, debt_id, kind, amount, wallet_id, cash_transaction_id)
       VALUES (auth.uid(), 'b0000000-0000-4000-8000-000000000008', 'repayment', 1, 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006')$q$,
    $q$INSERT INTO public.debt_activities (user_id, debt_id, kind, amount, wallet_id, cash_transaction_id)
       VALUES (auth.uid(), 'b0000000-0000-4000-8000-000000000008', 'repayment', 1, 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a')$q$,
    $q$INSERT INTO public.recurring_overrides (user_id, series_key, status, currency, wallet_id)
       VALUES (auth.uid(), 'MYR|expense|x', 'confirmed', 'MYR', 'a0000000-0000-4000-8000-000000000001')$q$,
    $q$INSERT INTO public.recurring_overrides (user_id, series_key, status, currency, category_id)
       VALUES (auth.uid(), 'MYR|expense|x', 'confirmed', 'MYR', 'a0000000-0000-4000-8000-000000000004')$q$,
    $q$INSERT INTO public.auto_add_rules (user_id, source_app, merchant_key, wallet_id, category_id)
       VALUES (auth.uid(), 'com.bank', 'x', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004')$q$,
    $q$INSERT INTO public.auto_add_rules (user_id, source_app, merchant_key, wallet_id, category_id)
       VALUES (auth.uid(), 'com.bank', 'x', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004')$q$,
    $q$UPDATE public.transactions SET category_id = 'a0000000-0000-4000-8000-000000000004'
       WHERE id = 'b0000000-0000-4000-8000-000000000006'$q$,
    $q$UPDATE public.transactions SET wallet_id = 'a0000000-0000-4000-8000-000000000001'
       WHERE id = 'b0000000-0000-4000-8000-000000000006'$q$,
    $q$UPDATE public.debt_activities SET debt_id = 'a0000000-0000-4000-8000-000000000008'
       WHERE id = 'b0000000-0000-4000-8000-000000000009'$q$,
    $q$INSERT INTO public.transactions (id, user_id, wallet_id, amount, currency, type)
       VALUES ('b0000000-0000-4000-8000-000000000006', auth.uid(), 'a0000000-0000-4000-8000-000000000001', 1, 'MYR', 'expense')
       ON CONFLICT (id) DO UPDATE SET wallet_id = excluded.wallet_id$q$
  ] LOOP
    BEGIN
      EXECUTE stmt;
      RAISE EXCEPTION 'not refused: %', stmt;
    EXCEPTION WHEN insufficient_privilege THEN
      IF SQLERRM NOT LIKE '%is not yours%' THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

-- A hard delete's SET NULL and CASCADE still go through.
RESET ROLE;
DELETE FROM public.categories WHERE id = 'a0000000-0000-4000-8000-000000000004';
DELETE FROM public.transactions WHERE id = 'a0000000-0000-4000-8000-000000000006';

DO $$
BEGIN
  IF (SELECT category_id FROM public.transactions WHERE id = 'a0000000-0000-4000-8000-000000000012') IS NOT NULL
    OR (SELECT transaction_id FROM public.proposed_transactions WHERE id = 'a0000000-0000-4000-8000-00000000000d') IS NOT NULL THEN
    RAISE EXCEPTION 'a hard delete did not clear its references';
  END IF;
END $$;

SELECT 'owned references: all checks passed' AS result;

ROLLBACK;
