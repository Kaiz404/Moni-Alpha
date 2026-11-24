-- A row may reference only rows its own user owns. RLS checks a row's own user_id, and a foreign
-- key check ignores RLS, so without this a client could point its row at another user's wallet,
-- category, transaction, tag or debt by UUID. A category may also be a system one (user_id IS NULL).
--
-- The check refuses a reference to a row that exists under another user. A missing row passes:
-- a foreign key already refuses one where the column has a key, and the debt references are
-- logical IDs, which Legend-State may upload before their row (20260717000000_budgets_and_debts.sql).
-- An update checks only the references it changes, so a cascade's SET NULL never trips it.
-- The refusal is 42501, as RLS raises, so the sync drops it instead of retrying it like a
-- foreign key's 23503 (PASSING_CODES in packages/data/src/gateway.ts).

CREATE OR REPLACE FUNCTION public.enforce_owned_references()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_row jsonb := to_jsonb(NEW);
  old_row jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END;
  ref_column text;
  parent text;
  ref uuid;
  present boolean;
  owner uuid;
BEGIN
  FOR i IN 0 .. TG_NARGS - 1 BY 2 LOOP
    ref_column := TG_ARGV[i];
    parent := TG_ARGV[i + 1];
    ref := (new_row ->> ref_column)::uuid;
    CONTINUE WHEN ref IS NULL;
    CONTINUE WHEN TG_OP = 'UPDATE'
      AND ref IS NOT DISTINCT FROM (old_row ->> ref_column)::uuid
      AND new_row -> 'user_id' IS NOT DISTINCT FROM old_row -> 'user_id';

    EXECUTE format('SELECT true, user_id FROM public.%I WHERE id = $1', parent) INTO present, owner USING ref;
    CONTINUE WHEN present IS NULL;
    CONTINUE WHEN owner IS NOT DISTINCT FROM (new_row ->> 'user_id')::uuid;
    CONTINUE WHEN parent = 'categories' AND owner IS NULL;

    RAISE EXCEPTION '%.% names a row in % that is not yours', TG_TABLE_NAME, ref_column, parent
      USING ERRCODE = 'insufficient_privilege';
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_owned_references() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enforce_owned_references
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owned_references(
    'wallet_id', 'wallets',
    'transfer_to_wallet_id', 'wallets',
    'category_id', 'categories',
    'linked_transaction_id', 'transactions',
    'debt_activity_id', 'debt_activities'
  );

CREATE TRIGGER enforce_owned_references
  BEFORE INSERT OR UPDATE ON public.transaction_tags
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owned_references(
    'transaction_id', 'transactions',
    'tag_id', 'tags'
  );

CREATE TRIGGER enforce_owned_references
  BEFORE INSERT OR UPDATE ON public.proposed_transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owned_references(
    'wallet_id', 'wallets',
    'transfer_to_wallet_id', 'wallets',
    'category_id', 'categories',
    'transaction_id', 'transactions'
  );

CREATE TRIGGER enforce_owned_references
  BEFORE INSERT OR UPDATE ON public.category_budgets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owned_references(
    'category_id', 'categories'
  );

CREATE TRIGGER enforce_owned_references
  BEFORE INSERT OR UPDATE ON public.debt_activities
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owned_references(
    'debt_id', 'debts',
    'wallet_id', 'wallets',
    'cash_transaction_id', 'transactions'
  );

CREATE TRIGGER enforce_owned_references
  BEFORE INSERT OR UPDATE ON public.recurring_overrides
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owned_references(
    'wallet_id', 'wallets',
    'category_id', 'categories'
  );

CREATE TRIGGER enforce_owned_references
  BEFORE INSERT OR UPDATE ON public.auto_add_rules
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owned_references(
    'wallet_id', 'wallets',
    'category_id', 'categories'
  );

-- A transfer moves one currency: its destination wallet has the source wallet's currency. Checked
-- when a row becomes a transfer or changes a wallet, so an untouched older row still syncs.
CREATE OR REPLACE FUNCTION public.enforce_transfer_currency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.type <> 'transfer' OR NEW.transfer_to_wallet_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
    AND NEW.type IS NOT DISTINCT FROM OLD.type
    AND NEW.wallet_id IS NOT DISTINCT FROM OLD.wallet_id
    AND NEW.transfer_to_wallet_id IS NOT DISTINCT FROM OLD.transfer_to_wallet_id THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.wallets source, public.wallets destination
    WHERE source.id = NEW.wallet_id
      AND destination.id = NEW.transfer_to_wallet_id
      AND source.currency <> destination.currency
  ) THEN
    RAISE EXCEPTION 'A transfer needs both wallets in the same currency'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_transfer_currency() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enforce_transfer_currency
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_transfer_currency();
